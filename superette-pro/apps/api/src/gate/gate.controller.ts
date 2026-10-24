import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { gateExitSchema, gateUnlockSchema, type GateExitInput, type GateUnlockInput, type GateUnlockResponse } from '@superette/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DeviceAuthGuard, type DeviceAuthenticatedRequest } from './device-auth.guard';
import { GateService } from './gate.service';

/**
 * De endpoints die de **fysieke deurscanner** aanroept.
 *
 * Nergens een `JwtAuthGuard`: de klant-app heeft hier niets te zoeken. Zou de app
 * zelf `/gate/unlock` mogen aanroepen, dan kan iedereen met een onderschepte
 * token vanaf zijn zetel de winkel openzetten. De telefoon toont enkel een
 * ondertekende claim; de scanner wisselt die in.
 */
@Controller('gate')
@UseGuards(DeviceAuthGuard)
export class GateController {
  constructor(private readonly gate: GateService) {}

  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  // Een scanner die vaker dan 60× per minuut aanklopt, is stuk of gekaapt.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  unlock(
    @Req() request: DeviceAuthenticatedRequest,
    @Body(new ZodValidationPipe(gateUnlockSchema)) input: GateUnlockInput,
  ): Promise<GateUnlockResponse> {
    // De cameraverwijzing wordt hier gestempeld, op het moment van de poging.
    // Zo koppelt de audit-trail elk toegangstijdstip aan een CCTV-fragment —
    // wat AVG art. 30 en de Belgische camerawet van je verlangen, en wat je
    // nodig hebt om beelden na de bewaartermijn gericht te kunnen wissen.
    const cameraRef = `${input.deviceId}/${new Date().toISOString()}`;

    return this.gate.unlock(request.store, input, cameraRef);
  }

  @Post('exit')
  @HttpCode(HttpStatus.NO_CONTENT)
  exit(
    @Req() request: DeviceAuthenticatedRequest,
    @Body(new ZodValidationPipe(gateExitSchema)) input: GateExitInput,
  ): Promise<void> {
    return this.gate.registerExit(request.store, input);
  }
}
