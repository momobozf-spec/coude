/**
 * De enige plek in de PWA die met de API praat.
 *
 * ## Waar het sessietoken staat
 *
 * In `localStorage`. Dat is een bewuste afweging met een echte keerzijde: een
 * XSS-lek geeft een aanvaller het token. Het alternatief — een `httpOnly`-cookie —
 * kan hier niet zomaar, want de API draait op een andere origin en een
 * cross-site cookie sneuvelt in Safari en in elke privacy-modus.
 *
 * De schade is begrensd: het token leeft één uur, en de deur opent er niet mee.
 * Wie het steelt kan hoogstens een QR-code opvragen — die vervalt binnen 60
 * seconden en werkt alleen als hij fysiek voor de juiste winkel staat.
 *
 * Vóór productie: token in geheugen + een refresh-token in een `httpOnly`-cookie
 * op een gedeeld hoofddomein (api.jamal-jamila.be / app.jamal-jamila.be).
 */
import type {
  AuthResponse,
  Basket,
  CheckoutInput,
  CheckoutResponse,
  ConsentState,
  GrantConsentInput,
  LoginInput,
  Receipt,
  RegisterInput,
  SessionUser,
} from '@superette/contracts';

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'jj.session';

export interface PublicStore {
  id: string;
  name: string;
  address: string;
  city: string;
  opensAtMinute: number;
  closesAtMinute: number;
  hasCapacity: boolean;
}

export interface AccessTokenResponse {
  qrPayload: string;
  expiresAt: string;
  rotateAfterSeconds: number;
  seq: number;
}

/** Een foutmelding van de API, met de HTTP-status erbij. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const session = {
  get: (): string | null => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string): void => window.localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => window.localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.get();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401) {
    // Het token is verlopen of ingetrokken. Opruimen, anders blijft de app in
    // een halfingelogde toestand hangen waarin elk verzoek stilletjes faalt.
    session.clear();
    throw new ApiError(401, 'Je sessie is verlopen. Log opnieuw in.');
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message = typeof payload?.['message'] === 'string' ? payload['message'] : 'Er ging iets mis';
    const issues = Array.isArray(payload?.['issues'])
      ? (payload['issues'] as Array<{ path: string; message: string }>)
      : undefined;
    throw new ApiError(response.status, message, issues);
  }

  return payload as T;
}

export const api = {
  stores: () => request<PublicStore[]>('GET', '/stores'),

  register: (input: RegisterInput) => request<AuthResponse>('POST', '/auth/register', input),
  login: (input: LoginInput) => request<AuthResponse>('POST', '/auth/login', input),
  me: () => request<SessionUser>('GET', '/auth/me'),

  consents: () => request<ConsentState[]>('GET', '/consents'),
  setConsent: (input: GrantConsentInput) => request<void>('POST', '/consents', input),

  accessToken: (storeId: string) => request<AccessTokenResponse>('POST', '/access/token', { storeId }),

  openBasket: (storeId: string) => request<Basket | null>('GET', `/baskets/open?storeId=${encodeURIComponent(storeId)}`),
  basket: (basketId: string) => request<Basket>('GET', `/baskets/${basketId}`),
  scan: (basketId: string, barcode: string, quantity = 1) =>
    request<Basket>('POST', '/baskets/scan', { basketId, barcode, quantity }),
  setQuantity: (basketId: string, productId: string, quantity: number) =>
    request<Basket>('PATCH', `/baskets/${basketId}/items`, { productId, quantity }),

  checkout: (input: CheckoutInput) => request<CheckoutResponse>('POST', '/checkout', input),

  receipts: () => request<Receipt[]>('GET', '/receipts'),
  receipt: (orderId: string) => request<Receipt>('GET', `/receipts/${orderId}`),
};
