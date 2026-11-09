import { Module } from '@nestjs/common';
import { CompareModule } from '../compare/compare.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CompareModule],
  controllers: [HealthController],
})
export class HealthModule {}
