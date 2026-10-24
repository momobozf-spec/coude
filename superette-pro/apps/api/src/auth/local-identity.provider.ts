import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IdentityProvider, VerifiedIdentity } from './identity-provider';

/**
 * Argon2id met OWASP-aanbevolen parameters (Password Storage Cheat Sheet):
 * 19 MiB geheugen, 2 iteraties, parallellisme 1.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Een échte Argon2-hash van een willekeurige waarde, één keer berekend.
 *
 * Doel: wanneer het e-mailadres niet bestaat, verifiëren we hiertegen zodat de
 * request evenveel rekentijd kost als een bestaande gebruiker. Zonder dit
 * antwoordt een onbekend adres in microseconden en een bekend adres in ~50ms —
 * en leest een aanvaller met een stopwatch je klantenbestand uit.
 *
 * Een *ongeldige* hardgecodeerde hash-string zou hier niet volstaan: `verify()`
 * faalt dan al bij het parsen, in microseconden, en het lek blijft bestaan.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash('argon2-timing-equalizer-not-a-real-password', ARGON2_OPTIONS);
  return dummyHashPromise;
}

@Injectable()
export class LocalIdentityProvider implements IdentityProvider {
  readonly name = 'LOCAL' as const;

  constructor(private readonly prisma: PrismaService) {}

  static hashPassword(plaintext: string): Promise<string> {
    return hash(plaintext, ARGON2_OPTIONS);
  }

  async authenticate(credentials: { email: string; password: string }): Promise<VerifiedIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email },
      select: { id: true, email: true, password: true, status: true, identityProvider: true },
    });

    // Ook bij een onbekende gebruiker draaien we een volledige Argon2-verificatie,
    // zodat de responstijd niets verraadt.
    const storedHash = user?.password ?? (await getDummyHash());
    const passwordMatches = await verify(storedHash, credentials.password).catch(() => false);

    if (!user || !user.password || !passwordMatches) {
      return null;
    }

    // Een geblokkeerde of gewiste gebruiker mag niet inloggen. We geven hier
    // bewust dezelfde `null` terug: waarom de login faalt is niets voor een
    // niet-geauthenticeerde beller.
    if (user.status !== 'ACTIVE') {
      return null;
    }

    return {
      provider: 'LOCAL',
      externalSubject: null,
      email: user.email,
      // Een e-mailadres bewijst geen identiteit en geen leeftijd. Punt.
      identityVerified: false,
      ageVerified: false,
    };
  }
}
