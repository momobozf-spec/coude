/**
 * De supermarktvergelijker als afzonderlijke bounded context.
 *
 * Deelt met de boetiek: `PrismaModule` (globaal), de JWT-strategie en de
 * sessies uit `AuthModule`, en de `User`-tabel. Verder niets: geen enkele
 * boetiekservice wordt hier geïmporteerd.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SUPERMARKET_ADAPTERS, assertUniqueAdapterKeys, supermarketAdapters } from './adapters/adapter-registry';
import { AlertsController } from './alerts/alerts.controller';
import { AlertsService } from './alerts/alerts.service';
import { ChainsController } from './catalog/chains.controller';
import { CompareCatalogService } from './catalog/compare-catalog.service';
import { CompareConfig } from './compare-config';
import { FeedPushController } from './feeds/feed-push.controller';
import { FeedPushService } from './feeds/feed-push.service';
import { ImportService } from './import/import.service';
import { JobKeyGuard } from './jobs/job-key.guard';
import { JobLeaseService } from './jobs/job-lease.service';
import { SyncController } from './jobs/sync.controller';
import { SyncService } from './jobs/sync.service';
import { ListsController } from './lists/lists.controller';
import { ListsService } from './lists/lists.service';
import { EmailChannel } from './notifications/email.channel';
import { EMAIL_TRANSPORT, createEmailTransport } from './notifications/email/email-transport';
import { InAppChannel } from './notifications/in-app.channel';
import { NOTIFICATION_CHANNELS } from './notifications/notification-channel';
import { NotificationDispatcherService } from './notifications/notification-dispatcher.service';
import { PreferencesController } from './preferences/preferences.controller';
import { PreferencesService } from './preferences/preferences.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';

assertUniqueAdapterKeys(supermarketAdapters);

@Module({
  imports: [AuthModule],
  controllers: [ChainsController, SearchController, ListsController, PreferencesController, AlertsController, SyncController, FeedPushController],
  providers: [
    CompareConfig,
    CompareCatalogService,
    { provide: SUPERMARKET_ADAPTERS, useValue: supermarketAdapters },
    ImportService,
    SearchService,
    PreferencesService,
    ListsService,
    AlertsService,
    InAppChannel,
    { provide: EMAIL_TRANSPORT, inject: [CompareConfig], useFactory: (config: CompareConfig) => createEmailTransport(config) },
    EmailChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [InAppChannel, EmailChannel],
      useFactory: (inApp: InAppChannel, email: EmailChannel) => [inApp, email],
    },
    NotificationDispatcherService,
    JobLeaseService,
    SyncService,
    FeedPushService,
    JobKeyGuard,
  ],
  exports: [SyncService, ImportService, AlertsService, ListsService, PreferencesService, JobKeyGuard, JobLeaseService, CompareConfig],
})
export class CompareModule {}
