import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { hashPassword, sessions, users, verifyPassword, type Database } from '@superrette/database';
import type { Locale } from '@superrette/domain';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@superrette/validation';
import type { AppConfig } from '../config/config.js';
import { Public, RateLimit, TokenService } from '../common/auth.js';
import { CONFIG, DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

type UserRow = typeof users.$inferSelect;

export function userDto(u: UserRow): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    locale: u.locale as Locale,
    countryCode: u.countryCode,
    onboardingCompleted: u.onboardingCompletedAt != null,
  };
}

// A real hash so that unknown e-mails cost the same time as wrong passwords.
const DUMMY_HASH = 'scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(86);

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly tokens: TokenService,
  ) {}

  private async issue(user: UserRow): Promise<AuthResponse> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlDays * 86_400_000),
    });
    return {
      user: userDto(user),
      accessToken: await this.tokens.signAccessToken({ id: user.id, role: user.role }),
      refreshToken,
      expiresIn: this.config.accessTokenTtlSeconds,
    };
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, input.email));
    if (existing)
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this e-mail already exists' });
    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName,
        locale: input.locale,
        countryCode: input.countryCode ?? null,
      })
      .returning();
    return this.issue(user!);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, input.email));
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid)
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid e-mail or password' });
    return this.issue(user);
  }

  /** Rotate the refresh token. Presenting an already-rotated token revokes every session (theft detection). */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, sha256(refreshToken)));
    if (!session) throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' });
    if (session.revokedAt) {
      await this.db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, session.userId), isNull(sessions.revokedAt)));
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Refresh token reuse detected; all sessions were signed out',
      });
    }
    if (session.expiresAt < new Date())
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_EXPIRED', message: 'Session expired' });
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));
    const [user] = await this.db.select().from(users).where(eq(users.id, session.userId));
    if (!user) throw new UnauthorizedException();
    return this.issue(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, sha256(refreshToken)));
  }
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit(10, 60)
  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Public()
  @RateLimit(20, 60)
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Public()
  @RateLimit(60, 60)
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) body: { refreshToken: string }): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
