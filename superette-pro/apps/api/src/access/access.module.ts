import { Module } from '@nestjs/common';
import { ConsentModule } from '../consent/consent.module';
import { AccessController } from './access.controller';
import { AccessTokenService } from './access-token.service';
import { GateKeysService } from './gate-keys.service';

@Module({
  imports: [ConsentModule],
  controllers: [AccessController],
  providers: [AccessTokenService, GateKeysService],
  exports: [AccessTokenService, GateKeysService],
})
export class AccessModule {}
