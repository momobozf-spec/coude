import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createCsrfMiddleware } from './auth/csrf.middleware';
import { ErrorReporter } from './common/error-reporter';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { StructuredLogger, type LogFormat } from './common/logger';
import { requestIdMiddleware } from './common/request-id.middleware';
import { createRequestLogger } from './common/request-logger.middleware';
import { createSecurityHeaders } from './common/security-headers.middleware';

async function bootstrap(): Promise<void> {
  const environment = process.env['NODE_ENV'] ?? 'development';
  const logFormat: LogFormat = (process.env['LOG_FORMAT'] as LogFormat | undefined) ?? (environment === 'production' ? 'json' : 'pretty');
  const version = process.env['APP_VERSION'] ?? 'dev';
  const logger = new StructuredLogger(
    { service: 'superette-api', environment, version },
    logFormat,
    environment === 'production' ? ['log', 'warn', 'error', 'fatal'] : ['log', 'warn', 'error', 'fatal', 'debug'],
  );

  // Foutmonitoring: alleen met een DSN; anders blijven fouten bij de logs.
  const dsn = process.env['ERROR_REPORTING_DSN']?.trim();
  if (dsn) {
    const reporter = new ErrorReporter(dsn, { service: 'superette-api', environment, version });
    logger.attachErrorSink((entry) => reporter.report(entry));
    logger.log('foutmonitoring gekoppeld via ERROR_REPORTING_DSN', 'Bootstrap');
  }

  // Body's parsen we zelf, met expliciete limieten: niemand hoeft ons megabytes
  // JSON te sturen. De Mollie-webhook praat urlencoded, vandaar de tweede parser.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger, bodyParser: false });

  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Achter een reverse proxy is `req.ip` anders het adres van de proxy.
  app.set('trust proxy', config.get<boolean | number | string>('TRUST_PROXY') ?? false);
  app.disable('x-powered-by');

  // Request-id en headers vóór de body-parsers: ook een "te groot"-fout krijgt
  // dan een request-id en de beveiligingsheaders mee.
  app.use(requestIdMiddleware);
  app.use(createSecurityHeaders({ hsts: config.get<boolean>('HSTS_ENABLED') ?? isProduction }));
  app.use(createRequestLogger(logger));

  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '16kb' });

  // Alle routes onder /api/v1 — het versienummer zit in het pad zodat een
  // deurscanner die je niet kunt updaten, op v1 kan blijven hangen terwijl de
  // app naar v2 gaat.
  app.setGlobalPrefix('api/v1');

  // Twee apps op twee origins delen deze API: de boetiek-PWA (APP_URL) en de
  // supermarktvergelijker (SUPERETTE_WEB_URL). Alleen expliciet genoemde origins.
  const origins = [
    config.get<string>('APP_URL'),
    config.get<string>('SUPERETTE_WEB_URL'),
    ...(config.get<string>('CORS_ORIGINS') ?? '').split(','),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => !!origin);
  const allowedOrigins = new Set(origins);

  app.use(createCsrfMiddleware(allowedOrigins));

  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-superette-client', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'retry-after'],
    maxAge: 600,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env['API_PORT'] ?? 4000);
  await app.listen(port);

  new Logger('Bootstrap').log(`Superette API luistert op http://localhost:${port}/api/v1 (${environment})`);
}

void bootstrap();
