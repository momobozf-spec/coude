import { NextResponse } from 'next/server';
import { register } from '@orbit/api-core';
import { registerSchema } from '@orbit/validation';
import { setSessionCookies } from '@/lib/api/cookies';
import { withPublic, clientIp } from '@/lib/api/handler';
import { authSecret, oauth, prisma } from '@/lib/api/runtime';

export const runtime = 'nodejs';

export const POST = withPublic(
  { schema: registerSchema, limit: 'register' },
  async ({ request, body }) => {
    const result = await register(
      { prisma: prisma(), secret: authSecret(), oauth: oauth() },
      body,
      { ip: clientIp(request), userAgent: request.headers.get('user-agent') },
    );

    const response = NextResponse.json({
      user: result.user,
      workspace: result.workspace,
      workspaces: result.workspaces,
      // Ook in de body: de mobiele app heeft geen cookiejar en bewaart deze
      // tokens zelf in de secure storage.
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      deviceId: result.deviceId,
    });

    setSessionCookies(response, { ...result, workspaceId: result.workspace.id });
    return response;
  },
);
