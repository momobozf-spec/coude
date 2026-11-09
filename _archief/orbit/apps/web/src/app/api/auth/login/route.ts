import { NextResponse } from 'next/server';
import { login } from '@orbit/api-core';
import { loginSchema } from '@orbit/validation';
import { setSessionCookies } from '@/lib/api/cookies';
import { withPublic, clientIp } from '@/lib/api/handler';
import { authSecret, prisma } from '@/lib/api/runtime';

export const runtime = 'nodejs';

export const POST = withPublic({ schema: loginSchema, limit: 'login' }, async ({ request, body }) => {
  const result = await login({ prisma: prisma(), secret: authSecret() }, body, {
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  const response = NextResponse.json({
    user: result.user,
    workspace: result.workspace,
    workspaces: result.workspaces,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
    deviceId: result.deviceId,
  });

  setSessionCookies(response, { ...result, workspaceId: result.workspace.id });
  return response;
});
