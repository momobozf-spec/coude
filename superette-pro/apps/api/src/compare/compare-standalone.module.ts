/**
 * Minimale applicatiecontext voor scripts (seed, handmatige sync): config,
 * database en de vergelijker — zonder MQTT, betalingen of HTTP.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../config/env';
import { PrismaModule } from '../prisma/prisma.module';
import { CompareModule } from './compare.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'], validate: validateEnv }),
    PrismaModule,
    CompareModule,
  ],
})
export class CompareStandaloneModule {}
