import { NextResponse } from 'next/server';
import { logout } from '@orbit/api-core';
import { verifyAccessToken } from '@orbit/auth';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies } from '@/lib/api/cookies';
import { withPublic } from '@/lib/api/handler';
import { authSecret, prisma } from '@/lib/api/runtime';

export const runtime = 'nodejs';

export const POST = withPublic({ limit: 'refresh' }, async ({ request }) => {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const url = new URL(request.url);
  const allDevices = url.searchParams.get('allDevices') === 'true';

  // Voor "overal uitloggen" hebben we de gebruiker nodig; die staat in het
  // access token, dat nog geldig kan zijn ook als de gebruiker uitlogt.
  const claims = accessToken ? await verifyAccessToken(accessToken, authSecret()) : null;

  await logout({ prisma: prisma(), secret: authSecret() }, {
    ...(refreshToken ? { refreshToken } : {}),
    allDevices,
    ...(claims ? { userId: claims.userId } : {}),
  });

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
});
