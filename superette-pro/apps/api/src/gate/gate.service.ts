import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type GateResult, type Store } from '@prisma/client';
import type { GateExitInput, GateUnlockInput, GateUnlockResponse } from '@superette/contracts';
import { GateKeysService } from '../access/gate-keys.service';
import { verifyGateToken } from '../access/gate-token';
import { ConsentService } from '../consent/consent.service';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from './mqtt.service';
import { isStoreOpenAt } from './store-hours';

/** Hoe lang het deurrelais aantrekt. Genoeg om binnen te stappen, te kort om iemand mee te nemen. */
const RELAY_HOLD_MS = 4_000;

/**
 * Interne afbreking van de ontgrendelstroom. Draagt de audit-reden mee.
 * Wordt nooit naar de client geworpen — die krijgt een `GateUnlockResponse`.
 */
class GateDenied extends Error {
  constructor(
    readonly result: GateResult,
    readonly auditReason: string,
    readonly tokenId: string | null = null,
    readonly userId: string | null = null,
  ) {
    super(auditReason);
    this.name = 'GateDenied';
  }
}

/** Wat de scanner op zijn schermpje mag tonen. */
const DISPLAY = {
  granted: { nl: 'Welkom bij Jamal & Jamila', fr: 'Bienvenue chez Jamal & Jamila' },
  /**
   * Eén generieke boodschap voor élke weigering.
   *
   * De fijnmazige reden staat in `AccessLog` voor de support-desk. Zou de scanner
   * "toestemming ontbreekt" tonen tegenover "token verlopen", dan vertel je een
   * aanvaller precies welke stap hij nog moet nemen.
   */
  denied: {
    nl: 'Toegang geweigerd. Open de app voor een nieuwe sleutel.',
    fr: "Accès refusé. Ouvrez l'application pour une nouvelle clé.",
  },
  unreachable: {
    nl: 'Deur reageert niet. Probeer opnieuw of bel de helpdesk.',
    fr: 'La porte ne répond pas. Réessayez ou appelez le service client.',
  },
} as const;

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: GateKeysService,
    private readonly consents: ConsentService,
    private readonly mqtt: MqttService,
  ) {}

  /**
   * Het volledige ontgrendelpad, aangeroepen door de **deurscanner**.
   *
   * De volgorde van de stappen is geen smaakkwestie:
   *
   *  1. **Handtekening eerst.** Alles daarna raakt de database. Een aanvaller met
   *     willekeurige QR-codes mag ons niet aan het queryen krijgen.
   *  2. **Geschiktheid vóór verbruik.** Zou de token verbruikt worden vóór we
   *     weten of de klant überhaupt binnen mag, dan verliest iemand met een
   *     ingetrokken toestemming zijn sleutel bij elke poging.
   *  3. **Verbruik en bezetting in één transactie.** Twee mensen die exact
   *     tegelijk de laatste plek claimen mogen niet allebei binnen.
   *  4. **MQTT ná de commit.** Publiceren in de transactie en dan de commit zien
   *     falen, betekent een open deur zonder registratie. Andersom — commit,
   *     dan een mislukte publish — is te repareren, en dat doen we ook.
   */
  async unlock(store: Store, input: GateUnlockInput, cameraRef: string): Promise<GateUnlockResponse> {
    try {
      const claims = await this.verifyAndMatchStore(store, input);
      const user = await this.assertEligible(store, claims.sub, claims.jti);

      const { basketId, logId } = await this.consumeAndAdmit(store, claims.jti, user.id, input.deviceId, cameraRef);

      // Vanaf hier is de klant geregistreerd als binnen. Faalt de deur nu, dan
      // moeten we dat terugdraaien — zie hieronder.
      try {
        await this.mqtt.publishUnlock(store.mqttTopicPrefix, {
          correlationId: logId,
          holdMilliseconds: RELAY_HOLD_MS,
          issuedAt: Date.now(),
        });
      } catch (error) {
        await this.compensateFailedUnlock(store.id, logId, error);
        return {
          granted: false,
          result: 'ERROR_GATE_UNREACHABLE',
          displayMessage: DISPLAY.unreachable,
          basketId: null,
        };
      }

      return { granted: true, result: 'GRANTED', displayMessage: DISPLAY.granted, basketId };
    } catch (error) {
      if (error instanceof GateDenied) {
        await this.writeLog({
          storeId: store.id,
          userId: error.userId,
          tokenId: error.tokenId,
          result: error.result,
          reason: error.auditReason,
          deviceId: input.deviceId,
          cameraRef,
        });

        return { granted: false, result: error.result, displayMessage: DISPLAY.denied, basketId: null };
      }
      throw error;
    }
  }

  /** Stap 1: cryptografie en winkel-match. Raakt de database niet. */
  private async verifyAndMatchStore(store: Store, input: GateUnlockInput) {
    const verified = await verifyGateToken(input.qrPayload, this.keys.publicKey);

    if (!verified.ok) {
      const result: GateResult = verified.reason === 'EXPIRED' ? 'DENIED_EXPIRED' : 'DENIED_INVALID_SIGNATURE';
      throw new GateDenied(result, `Tokenverificatie mislukt: ${verified.reason}`);
    }

    // Een geldig ondertekende sleutel voor Antwerpen opent Gent niet. Zonder deze
    // check is één gecompromitteerde winkel meteen álle winkels.
    if (verified.claims.sid !== store.id) {
      throw new GateDenied(
        'DENIED_WRONG_STORE',
        `Token voor winkel ${verified.claims.sid} aangeboden aan ${store.id}`,
        verified.claims.jti,
        verified.claims.sub,
      );
    }

    return verified.claims;
  }

  /** Stap 2: mag deze persoon, in deze winkel, op dit moment naar binnen? */
  private async assertEligible(store: Store, userId: string, tokenId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true, identityVerified: true },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new GateDenied('DENIED_USER_BLOCKED', `Gebruiker ${userId} is niet actief`, tokenId, userId);
    }

    // Vandaag staat dit overal op `false`, want we draaien op e-mail + wachtwoord.
    // Zodra itsme aangesloten is, zet je `requiresVerifiedIdentity` op de winkel
    // aan en weigert deze regel iedereen zonder sterk geverifieerde identiteit.
    // Er hoeft dan niets aan deze code te veranderen.
    if (store.requiresVerifiedIdentity && !user.identityVerified) {
      throw new GateDenied('DENIED_IDENTITY_REQUIRED', 'Winkel vereist geverifieerde identiteit', tokenId, userId);
    }

    // Opnieuw controleren, ook al deed `AccessTokenService.issue` het al. Een
    // klant kan zijn toestemming intrekken tussen het ophalen van de QR en het
    // scannen ervan. Vertrouw nooit op een check verderop in de keten.
    if (!(await this.consents.hasRequiredConsents(userId))) {
      throw new GateDenied('DENIED_CONSENT_MISSING', 'Verplichte AVG-toestemming ontbreekt', tokenId, userId);
    }

    if (!isStoreOpenAt(new Date(), store)) {
      throw new GateDenied('DENIED_STORE_CLOSED', 'Buiten openingsuren', tokenId, userId);
    }

    return user;
  }

  /**
   * Stap 3: verbruik de token, claim een plek, open een winkelmandje — atomair.
   *
   * Alles in één transactie omdat elk van de drie de andere twee ongeldig maakt
   * als het faalt. Half binnen bestaat niet.
   */
  private async consumeAndAdmit(
    store: Store,
    tokenId: string,
    userId: string,
    deviceId: string,
    cameraRef: string,
  ): Promise<{ basketId: string; logId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // ── Eenmalig gebruik ────────────────────────────────────────────────
      // Eén UPDATE die alleen slaagt als de token nog leeft. Geen SELECT-dan-UPDATE:
      // tussen die twee passen twee gelijktijdige scans van dezelfde QR.
      const consumed = await tx.accessToken.updateMany({
        where: { id: tokenId, usedAt: null, supersededAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw await this.classifyConsumeFailure(tx, tokenId, userId, now);
      }

      // ── Bezetting ───────────────────────────────────────────────────────
      // Kolom-met-kolom vergelijken kan Prisma's `updateMany` niet, vandaar raw
      // SQL. De WHERE-clausule is het slot: twee gelijktijdige verzoeken om de
      // laatste plek kunnen niet allebei slagen.
      const admitted = await tx.$executeRaw`
        UPDATE "Store"
           SET "currentOccupancy" = "currentOccupancy" + 1
         WHERE "id" = ${store.id}
           AND "currentOccupancy" < "maxOccupancy"
      `;

      if (admitted !== 1) {
        // Rolt ook het tokenverbruik terug — de klant houdt zijn sleutel.
        throw new GateDenied('DENIED_STORE_FULL', 'Maximale bezetting bereikt', tokenId, userId);
      }

      // ── Winkelmandje ────────────────────────────────────────────────────
      // Eén open mand per klant per winkel. Kwam hij eerder binnen zonder af te
      // rekenen, dan pakt hij die mand weer op — niet een nieuwe naast de oude.
      const existing = await tx.basket.findFirst({
        where: { userId, storeId: store.id, status: 'OPEN' },
        select: { id: true },
      });

      const basket = existing ?? (await tx.basket.create({ data: { userId, storeId: store.id }, select: { id: true } }));

      const log = await tx.accessLog.create({
        data: {
          userId,
          storeId: store.id,
          tokenId,
          result: 'GRANTED',
          deviceId,
          cameraRef,
        },
        select: { id: true },
      });

      return { basketId: basket.id, logId: log.id };
    });
  }

  /**
   * De atomaire UPDATE raakte geen rij. Zoek uit waarom, zodat de audit-trail het
   * verschil kent tussen een trage klant, een screenshot en een replay-poging.
   */
  private async classifyConsumeFailure(
    tx: Prisma.TransactionClient,
    tokenId: string,
    userId: string,
    now: Date,
  ): Promise<GateDenied> {
    const token = await tx.accessToken.findUnique({
      where: { id: tokenId },
      select: { usedAt: true, supersededAt: true, expiresAt: true },
    });

    // Handtekening klopte, maar de rij bestaat niet meer: opgeruimd na verval.
    if (!token) {
      return new GateDenied('DENIED_EXPIRED', 'Token onbekend (opgeruimd)', tokenId, userId);
    }

    // Volgorde is bewust: al gebruikt weegt zwaarder dan achterhaald. Iemand die
    // dezelfde QR twee keer scant, is een ander verhaal dan iemand met een oude.
    if (token.usedAt) {
      return new GateDenied('DENIED_REPLAY', `Token al gebruikt op ${token.usedAt.toISOString()}`, tokenId, userId);
    }
    if (token.supersededAt) {
      return new GateDenied('DENIED_SUPERSEDED', 'Nieuwere sleutel uitgegeven', tokenId, userId);
    }
    if (token.expiresAt <= now) {
      return new GateDenied('DENIED_EXPIRED', 'Token verlopen', tokenId, userId);
    }

    return new GateDenied('DENIED_INVALID_SIGNATURE', 'Onverklaarde consume-fout', tokenId, userId);
  }

  /**
   * De transactie slaagde maar het relais bleef stil. De klant staat buiten,
   * terwijl onze administratie zegt dat hij binnen is.
   *
   * Wat we terugdraaien: de bezettingsteller. Anders loopt de winkel na een paar
   * MQTT-storingen "vol" met mensen die er nooit binnen kwamen.
   *
   * Wat we bewust *niet* terugdraaien: het tokenverbruik. De app geeft binnen
   * 30 seconden toch een nieuwe sleutel uit, en een token die tussen twee
   * scanpogingen weer tot leven komt, is precies het soort race waar replay-
   * bescherming op stukloopt.
   */
  private async compensateFailedUnlock(storeId: string, logId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Deur onbereikbaar voor winkel ${storeId}: ${message}`);

    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "Store"
           SET "currentOccupancy" = GREATEST("currentOccupancy" - 1, 0)
         WHERE "id" = ${storeId}
      `,
      this.prisma.accessLog.update({
        where: { id: logId },
        data: { result: 'ERROR_GATE_UNREACHABLE', reason: `MQTT-publicatie mislukt: ${message}` },
      }),
    ]);
  }

  /**
   * De klant verlaat de winkel. Verlaagt de bezetting en sluit een leeg mandje af.
   *
   * `GREATEST(…, 0)` omdat een dubbel exit-signaal — een uitgangsscanner die
   * hapert, een klant die twee keer langs de sensor loopt — de teller niet
   * negatief mag maken. Dan zou de volgende klant er "gratis" bij kunnen.
   */
  async registerExit(store: Store, input: GateExitInput): Promise<void> {
    const basket = await this.prisma.basket.findUnique({
      where: { id: input.basketId },
      select: { id: true, storeId: true, status: true, items: { select: { id: true }, take: 1 } },
    });

    if (!basket || basket.storeId !== store.id) {
      throw new NotFoundException('Winkelmandje hoort niet bij deze winkel');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Store"
           SET "currentOccupancy" = GREATEST("currentOccupancy" - 1, 0)
         WHERE "id" = ${store.id}
      `;

      // Een openstaand mandje mét producten is een klant die de winkel uit liep
      // zonder te betalen. Markeren als ABANDONED, niet stilzwijgend weggooien:
      // dit is precies het signaal waar de uitbater op wil kunnen opvolgen.
      //
      // Een leeg mandje laten we met rust: iemand die binnenkwam, rondkeek en
      // weer buitenging heeft niets misdaan. Zijn mandje wacht op zijn volgende
      // bezoek (zie `consumeAndAdmit` — die pakt een bestaande OPEN mand op).
      if (basket.status === 'OPEN' && basket.items.length > 0) {
        await tx.basket.update({
          where: { id: basket.id },
          data: { status: 'ABANDONED', closedAt: new Date() },
        });
      }
    });
  }

  /** Elke poging landt in de audit-trail — geslaagd of niet. Dit is de wettelijke kern. */
  private async writeLog(data: {
    storeId: string;
    userId: string | null;
    tokenId: string | null;
    result: GateResult;
    reason: string;
    deviceId: string;
    cameraRef: string;
  }): Promise<void> {
    await this.prisma.accessLog.create({ data });
  }
}
