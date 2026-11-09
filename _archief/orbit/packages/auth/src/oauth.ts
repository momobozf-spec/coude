import { AuthProvider } from '@orbit/types';
import { SignJWT, decodeJwt, importPKCS8 } from 'jose';
import { codeChallengeFor } from './tokens';

/**
 * OAuth 2.0 authorization-code flow met PKCE.
 *
 * PKCE ook op web, niet alleen op mobiel: het maakt een onderschepte
 * authorization code waardeloos zonder de verifier, en het kost ons niets.
 *
 * Alle providers achter één interface, zodat er later eentje bij kan zonder dat
 * de auth-flow zelf verandert.
 */

export interface OAuthProfile {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  /** Alleen Apple: de private key voor het client-secret (ES256). */
  privateKey?: string;
  teamId?: string;
  keyId?: string;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface OAuthProviderAdapter {
  readonly provider: AuthProvider;
  buildAuthorizationUrl(input: {
    redirectUri: string;
    state: string;
    codeVerifier: string;
  }): string;
  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OAuthProfile>;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface IdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(`OAuth-uitwisseling mislukt: ${payload.error_description ?? payload.error ?? response.status}`);
  }
  return payload;
}

function claimsFromIdToken(idToken: string): IdTokenClaims {
  // De id_token komt rechtstreeks uit de token-endpoint over TLS, dus de
  // handtekening is al impliciet gevalideerd door het kanaal. We lezen hem
  // alleen uit; we accepteren nooit een id_token die de client zelf aanlevert.
  return decodeJwt(idToken) as IdTokenClaims;
}

function isVerified(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export function createGoogleProvider(config: OAuthProviderConfig): OAuthProviderAdapter {
  return {
    provider: AuthProvider.Google,

    buildAuthorizationUrl({ redirectUri, state, codeVerifier }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallengeFor(codeVerifier),
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const tokens = await postForm('https://oauth2.googleapis.com/token', {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
      if (!tokens.id_token) throw new Error('Google gaf geen id_token terug');
      const claims = claimsFromIdToken(tokens.id_token);
      if (!claims.sub) throw new Error('Google gaf geen account-id terug');
      return {
        provider: AuthProvider.Google,
        providerAccountId: claims.sub,
        email: claims.email ?? null,
        emailVerified: isVerified(claims.email_verified),
        name: claims.name ?? null,
        avatarUrl: claims.picture ?? null,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Microsoft (persoonlijke accounts en Microsoft 365)
// ---------------------------------------------------------------------------

export function createMicrosoftProvider(config: OAuthProviderConfig): OAuthProviderAdapter {
  const tenant = 'common';
  return {
    provider: AuthProvider.Microsoft,

    buildAuthorizationUrl({ redirectUri, state, codeVerifier }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        // offline_access is nodig om later de agenda te kunnen koppelen.
        scope: 'openid email profile offline_access',
        state,
        code_challenge: codeChallengeFor(codeVerifier),
        code_challenge_method: 'S256',
      });
      return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const tokens = await postForm(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        },
      );
      if (!tokens.id_token) throw new Error('Microsoft gaf geen id_token terug');
      const claims = claimsFromIdToken(tokens.id_token);
      if (!claims.sub) throw new Error('Microsoft gaf geen account-id terug');
      const name =
        claims.name ??
        [claims.given_name, claims.family_name].filter(Boolean).join(' ') ??
        null;
      return {
        provider: AuthProvider.Microsoft,
        providerAccountId: claims.sub,
        email: claims.email ?? null,
        emailVerified: isVerified(claims.email_verified),
        name: name || null,
        avatarUrl: null,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

/**
 * Apple wijkt af: het client secret is geen vaste string maar een ES256-JWT die
 * je zelf ondertekent met de private key uit het developer-portaal, en die
 * maximaal zes maanden geldig is. We maken hem per uitwisseling opnieuw.
 */
async function appleClientSecret(config: OAuthProviderConfig, now: Date): Promise<string> {
  if (!config.privateKey || !config.teamId || !config.keyId) {
    throw new Error('Apple Sign-In vereist privateKey, teamId en keyId');
  }
  const key = await importPKCS8(config.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 15 * 60)
    .setAudience('https://appleid.apple.com')
    .setSubject(config.clientId)
    .sign(key);
}

export function createAppleProvider(config: OAuthProviderConfig): OAuthProviderAdapter {
  return {
    provider: AuthProvider.Apple,

    buildAuthorizationUrl({ redirectUri, state, codeVerifier }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'name email',
        // Apple eist form_post zodra je scopes opvraagt.
        response_mode: 'form_post',
        state,
        code_challenge: codeChallengeFor(codeVerifier),
        code_challenge_method: 'S256',
      });
      return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const secret = await appleClientSecret(config, new Date());
      const tokens = await postForm('https://appleid.apple.com/auth/token', {
        client_id: config.clientId,
        client_secret: secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
      if (!tokens.id_token) throw new Error('Apple gaf geen id_token terug');
      const claims = claimsFromIdToken(tokens.id_token);
      if (!claims.sub) throw new Error('Apple gaf geen account-id terug');
      return {
        provider: AuthProvider.Apple,
        providerAccountId: claims.sub,
        email: claims.email ?? null,
        emailVerified: isVerified(claims.email_verified),
        // Apple stuurt de naam alleen bij de allereerste autorisatie mee, in de
        // form-post en niet in de id_token. De aanroeper vult hem eventueel aan.
        name: null,
        avatarUrl: null,
      };
    },
  };
}

export interface OAuthRegistry {
  get(provider: AuthProvider): OAuthProviderAdapter;
  has(provider: AuthProvider): boolean;
}

export function createOAuthRegistry(
  configs: Partial<Record<AuthProvider, OAuthProviderConfig>>,
): OAuthRegistry {
  const adapters = new Map<AuthProvider, OAuthProviderAdapter>();
  if (configs.GOOGLE) adapters.set(AuthProvider.Google, createGoogleProvider(configs.GOOGLE));
  if (configs.MICROSOFT) {
    adapters.set(AuthProvider.Microsoft, createMicrosoftProvider(configs.MICROSOFT));
  }
  if (configs.APPLE) adapters.set(AuthProvider.Apple, createAppleProvider(configs.APPLE));

  return {
    has: (provider) => adapters.has(provider),
    get(provider) {
      const adapter = adapters.get(provider);
      if (!adapter) throw new Error(`Inloggen via ${provider} is niet geconfigureerd`);
      return adapter;
    },
  };
}
