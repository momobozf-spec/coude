import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MollieGateway } from './mollie.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { StubPaymentGateway } from './stub.gateway';

@Global()
@Module({
  providers: [
    MollieGateway,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService, MollieGateway],
      useFactory: (config: ConfigService, mollie: MollieGateway) => {
        const apiKey = config.get<string>('MOLLIE_API_KEY');

        if (apiKey) return mollie;

        // Zonder sleutel kán er niet betaald worden. In productie is dat een
        // fatale configuratiefout, geen reden om stilletjes alles gratis weg te
        // geven. `env.ts` weigert overigens al te starten zonder sleutel in
        // productie — dit is de tweede grendel op dezelfde deur.
        if (config.getOrThrow<string>('NODE_ENV') === 'production') {
          throw new Error('MOLLIE_API_KEY is verplicht in productie');
        }

        return new StubPaymentGateway(config.getOrThrow<string>('APP_URL'));
      },
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
