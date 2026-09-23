import { Module } from '@nestjs/common';
import { CoreModule } from './common/core.module.js';
import { AdminModule } from './modules/admin.module.js';
import { AlertsModule } from './modules/alerts.module.js';
import { AuthModule } from './modules/auth.module.js';
import { FavoritesModule } from './modules/favorites.module.js';
import { HealthModule } from './modules/health.module.js';
import { HomeModule } from './modules/home.module.js';
import { ListsModule } from './modules/lists/lists.module.js';
import { MeModule } from './modules/me.module.js';
import { NotificationsModule } from './modules/notifications.module.js';
import { ProductsModule } from './modules/products.module.js';
import { PromotionsModule } from './modules/promotions.module.js';
import { ReferenceModule } from './modules/reference.module.js';
import { SearchModule } from './modules/search.module.js';
import { SubscriptionsModule } from './modules/subscriptions.module.js';

@Module({
  imports: [
    CoreModule,
    HealthModule,
    AuthModule,
    MeModule,
    ReferenceModule,
    SearchModule,
    ProductsModule,
    FavoritesModule,
    ListsModule,
    PromotionsModule,
    AlertsModule,
    NotificationsModule,
    HomeModule,
    SubscriptionsModule,
    AdminModule,
  ],
})
export class AppModule {}
