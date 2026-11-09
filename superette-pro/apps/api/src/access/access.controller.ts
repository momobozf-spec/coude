import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { issueAccessTokenSchema, type AccessTokenResponse, type IssueAccessTokenInput, type SessionUser } from '@superette/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccessTokenService } from './access-token.service';

@Controller('access')
@UseGuards(JwtAuthGuard)
export class AccessController {
  constructor(private readonly tokens: AccessTokenService) {}

  /**
   * Geeft de QR-sleutel voor de "Mijn Sleutel"-pagina.
   *
   * De app roept dit elke `rotateAfterSeconds` opnieuw aan. De limiet staat op
   * 30 per minuut: ruim boven de normale rotatie van 2/min, laag genoeg om
   * iemand die duizenden tokens opvraagt af te remmen.
   */
  @Post('token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  issue(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(issueAccessTokenSchema)) input: IssueAccessTokenInput,
  ): Promise<AccessTokenResponse> {
    return this.tokens.issue(user.id, input.storeId);
  }
}
