import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { deleteAccountSchema, type AccountExport, type DeleteAccountInput, type SessionUser } from '@superette/contracts';
import type { Response } from 'express';
import { clearAuthCookies } from '../auth/auth-cookies';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountService } from './account.service';

/** Gegevensexport en accountverwijdering. Alleen voor de ingelogde gebruiker zelf. */
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: ConfigService,
  ) {}

  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Content-Disposition', 'attachment; filename="superette-gegevens.json"')
  @Header('Cache-Control', 'no-store')
  export(@CurrentUser() user: SessionUser & { sessionId?: string | null }): Promise<AccountExport> {
    return this.account.export(user.id, user.sessionId ?? null);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  // Vijf per minuut, zoals login: herauthenticatie met wachtwoord mag geen brute-force-pad zijn.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async remove(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) input: DeleteAccountInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.account.deleteAccount(user.id, input.password);
    clearAuthCookies(response, {
      secure: this.config.get<boolean>('COOKIE_SECURE') ?? this.config.get<string>('NODE_ENV') === 'production',
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
    });
  }
}
