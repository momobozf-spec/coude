import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConsentModule } from '../consent/consent.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IDENTITY_PROVIDER } from './identity-provider';
import { JwtStrategy } from './jwt.strategy';
import { LocalIdentityProvider } from './local-identity.provider';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    ConsentModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    JwtStrategy,
    LocalIdentityProvider,
    {
      // Dit is de enige plek die weet wélke identiteitsprovider draait.
      // Voor itsme: vervang `LocalIdentityProvider` door `ItsmeIdentityProvider`
      // (of kies op basis van config). Niets anders in de codebase wijzigt.
      provide: IDENTITY_PROVIDER,
      useExisting: LocalIdentityProvider,
    },
  ],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
