import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateComparePreferencesSchema, type ComparePreferences, type SessionUser, type UpdateComparePreferencesInput } from '@superette/contracts';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PreferencesService } from './preferences.service';

/** Winkelvoorkeuren in het profiel. Bezoekers zonder account bewaren ze lokaal in de app. */
@Controller('compare/preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): Promise<ComparePreferences> {
    return this.preferences.get(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(updateComparePreferencesSchema)) input: UpdateComparePreferencesInput,
  ): Promise<ComparePreferences> {
    return this.preferences.update(user.id, input);
  }
}
