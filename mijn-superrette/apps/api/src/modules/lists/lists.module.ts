import { Module } from '@nestjs/common';
import { SearchModule } from '../search.module.js';
import { BasketService } from './basket.service.js';
import { ListsController } from './lists.controller.js';
import { ListsGateway } from './lists.gateway.js';
import { ListsService } from './lists.service.js';

@Module({
  imports: [SearchModule],
  controllers: [ListsController],
  providers: [ListsService, BasketService, ListsGateway],
  exports: [ListsService],
})
export class ListsModule {}
