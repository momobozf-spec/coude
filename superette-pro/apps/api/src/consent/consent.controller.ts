import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { grantConsentSchema, type ConsentState, type GrantConsentInput } from '@superette/contracts';
import type { Request } from 'express';
import type { SessionUser } from '@superette/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConsentService } from './consent.service';

@Controller('consents')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(private readonly consents: ConsentService) {}

  /** De actuele toestemmingsstand, zoals getoond in het privacyscherm van de app. */
  @Get()
  current(@CurrentUser() user: SessionUser): Promise<ConsentState[]> {
    return this.consents.currentState(user.id);
  }

  /**
   * Geeft of trekt één toestemming in.
   *
   * Trekt de klant `ACCESS_LOG` of `CAMERA` in, dan slaagt deze call gewoon —
   * maar gaat de deur daarna niet meer open. Dat is geen fout; het is het recht
   * van de klant, met een gevolg dat de app hem duidelijk moet tonen.
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(grantConsentSchema)) input: GrantConsentInput,
    @Ip() ip: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.consents.record(user.id, input.type, input.granted, {
      ipAddress: ip,
      userAgent: request.get('user-agent'),
    });
  }
}
