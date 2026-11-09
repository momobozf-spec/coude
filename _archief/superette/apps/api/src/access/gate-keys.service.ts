import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importJWK, type JWK } from 'jose';
import type { SigningKey } from './gate-token';

/**
 * Laadt het Ed25519-sleutelpaar één keer bij het opstarten.
 *
 * De private key blijft in dit proces. Op de deurscanner hoort alléén de public
 * key te staan — genoeg om een QR te verifiëren, waardeloos om er een te maken.
 * Wie de scanner uit de muur trekt, heeft daarmee niets.
 */
@Injectable()
export class GateKeysService implements OnModuleInit {
  private readonly logger = new Logger(GateKeysService.name);

  private privateKeyValue!: SigningKey;
  private publicKeyValue!: SigningKey;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const privateJwk = JSON.parse(this.config.getOrThrow<string>('GATE_SIGNING_PRIVATE_JWK')) as JWK;
    const publicJwk = JSON.parse(this.config.getOrThrow<string>('GATE_SIGNING_PUBLIC_JWK')) as JWK;

    if (!privateJwk.d) {
      throw new Error('GATE_SIGNING_PRIVATE_JWK mist de private component `d` — dit is een public key');
    }
    if (publicJwk.d) {
      throw new Error(
        'GATE_SIGNING_PUBLIC_JWK bevat een private component `d`. ' +
          'Zet nooit de private key op de plek van de public key — die gaat naar de deurscanner.',
      );
    }
    if (privateJwk.x !== publicJwk.x) {
      throw new Error('GATE_SIGNING_PRIVATE_JWK en GATE_SIGNING_PUBLIC_JWK horen niet bij elkaar');
    }

    this.privateKeyValue = (await importJWK(privateJwk, 'EdDSA')) as SigningKey;
    this.publicKeyValue = (await importJWK(publicJwk, 'EdDSA')) as SigningKey;

    this.logger.log('Ed25519-sleutelpaar voor toegangstokens geladen');
  }

  get privateKey(): SigningKey {
    return this.privateKeyValue;
  }

  get publicKey(): SigningKey {
    return this.publicKeyValue;
  }
}
