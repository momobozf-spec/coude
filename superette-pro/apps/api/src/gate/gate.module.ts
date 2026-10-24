import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ConsentModule } from '../consent/consent.module';
import { DevDeviceKeyCheck } from './dev-device-key.check';
import { DeviceAuthGuard } from './device-auth.guard';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { MqttService } from './mqtt.service';

@Module({
  imports: [AccessModule, ConsentModule],
  controllers: [GateController],
  providers: [GateService, MqttService, DeviceAuthGuard, DevDeviceKeyCheck],
  exports: [MqttService],
})
export class GateModule {}
