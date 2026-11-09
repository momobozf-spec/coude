/**
 * De enige plek in de app die met de API praat.
 *
 * ## Sessie
 *
 * Er staat géén token in de browser die JavaScript kan lezen. De API zet
 * HttpOnly-cookies (een kort access-token en een lang refresh-token); de app
 * stuurt ze mee met `credentials: 'include'` en meldt zich met de header
 * `x-superette-client: web`. Die header is tegelijk de CSRF-grendel: zonder
 * header leest de API de cookie niet, en een vreemde site kan hem niet zetten.
 *
 * Verloopt het access-token, dan vraagt de app één keer stil een nieuw aan via
 * `/auth/refresh` en herhaalt het verzoek. Lukt dat niet, dan is de sessie
 * voorbij: de app meldt dat en stuurt naar het loginscherm.
 *
 * ## Geheimen
 *
 * Deze app kent geen interne sleutels. `COMPARE_JOB_KEY` en de interne
 * sync-route zijn uitsluitend server-side; niets daarvan staat in een
 * `NEXT_PUBLIC_`-variabele of in deze bundel.
 */
import {
  AUTH_CLIENT_HEADER,
  type AccountExport,
  type AddShoppingListItemInput,
  type AlertListQuery,
  type AlertNotification,
  type AlertPreview,
  type BasketCompareInput,
  type BasketCompareResult,
  type CatalogCategory,
  type ComparePreferences,
  type CreatePriceAlertInput,
  type CreateShoppingListInput,
  type DeleteAccountInput,
  type LoginInput,
  type PriceAlert,
  type PriceHistorySummary,
  type ProductDetail,
  type PromotionsQuery,
  type RegisterSuperetteInput,
  type ReportMatchInput,
  type SearchQueryInput,
  type SearchResponse,
  type SessionUser,
  type ShoppingList,
  type ShoppingListSummary,
  type StoreChain,
  type StoreLocation,
  type UpdateComparePreferencesInput,
  type UpdatePriceAlertInput,
  type UpdateShoppingListInput,
  type UpdateShoppingListItemInput,
  type WebSessionResponse,
} from '@superette/contracts';

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

/** Gebeurtenis voor de rest van de app: de sessie is definitief weg. */
export const SESSION_EXPIRED_EVENT = 'superette:session-expired';

/** Een foutmelding van de API, met de HTTP-status, foutcode en eventuele veldfouten. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: Array<{ path: string; message: string }>,
    readonly code?: string,
    readonly extra?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Netwerk weg of server onbereikbaar: niets ontvangen. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

/** Kleine, bewust niet-generieke querystring-bouwer: arrays als kommagescheiden lijst. */
function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function rawFetch(method: string, path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        [AUTH_CLIENT_HEADER]: 'web',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
}

async function toError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const message = typeof payload?.['message'] === 'string' ? payload['message'] : 'Er ging iets mis';
  const issues = Array.isArray(payload?.['issues']) ? (payload['issues'] as Array<{ path: string; message: string }>) : undefined;
  const code = typeof payload?.['code'] === 'string' ? payload['code'] : undefined;
  const requestId = typeof payload?.['requestId'] === 'string' ? payload['requestId'] : (response.headers.get('x-request-id') ?? undefined);
  return new ApiError(response.status, message, issues, code, payload ?? undefined, requestId);
}

/** Eén lopende vernieuwing tegelijk, zodat parallelle 401's niet elk een refresh starten. */
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= rawFetch('POST', '/auth/refresh')
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register-superette', '/auth/refresh', '/auth/logout'];

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const response = await rawFetch(method, path, body);

  if (response.status === 401 && !retried && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await tryRefresh()) return request<T>(method, path, body, true);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(401, 'sessionExpired', undefined, 'SESSION_EXPIRED');
  }

  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  // ── Publiek ──────────────────────────────────────────────────────────────
  chains: () => request<StoreChain[]>('GET', '/compare/chains'),
  locations: (slug: string, params: { postalCode?: string; city?: string } = {}) =>
    request<StoreLocation[]>('GET', `/compare/chains/${encodeURIComponent(slug)}/locations${query(params)}`),
  categories: () => request<CatalogCategory[]>('GET', '/compare/categories'),
  search: (input: SearchQueryInput) => request<SearchResponse>('GET', `/compare/search${query(input)}`),
  promotions: (input: Partial<PromotionsQuery> & { chains?: string[] } = {}) =>
    request<SearchResponse>('GET', `/compare/promotions${query(input)}`),
  product: (id: string, params: { chains?: string[]; includePersonalized?: boolean; includeOnline?: boolean; loyaltyCard?: string } = {}) =>
    request<ProductDetail>('GET', `/compare/products/${encodeURIComponent(id)}${query(params)}`),
  history: (id: string) => request<PriceHistorySummary>('GET', `/compare/products/${encodeURIComponent(id)}/history`),
  reportMatch: (id: string, input: ReportMatchInput) =>
    request<{ reported: true }>('POST', `/compare/products/${encodeURIComponent(id)}/report-match`, input),

  // ── Account en sessie ────────────────────────────────────────────────────
  register: (input: RegisterSuperetteInput) => request<WebSessionResponse>('POST', '/auth/register-superette', input),
  login: (input: LoginInput) => request<WebSessionResponse>('POST', '/auth/login', input),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<SessionUser>('GET', '/auth/me'),
  exportAccount: () => request<AccountExport>('GET', '/account/export'),
  deleteAccount: (input: DeleteAccountInput) => request<void>('DELETE', '/account', input),

  // ── Voorkeuren ───────────────────────────────────────────────────────────
  preferences: () => request<ComparePreferences>('GET', '/compare/preferences'),
  updatePreferences: (input: UpdateComparePreferencesInput) => request<ComparePreferences>('PATCH', '/compare/preferences', input),

  // ── Lijsten ──────────────────────────────────────────────────────────────
  lists: () => request<ShoppingListSummary[]>('GET', '/compare/lists'),
  createList: (input: CreateShoppingListInput) => request<ShoppingList>('POST', '/compare/lists', input),
  list: (id: string) => request<ShoppingList>('GET', `/compare/lists/${encodeURIComponent(id)}`),
  updateList: (id: string, input: UpdateShoppingListInput) => request<ShoppingList>('PATCH', `/compare/lists/${encodeURIComponent(id)}`, input),
  deleteList: (id: string) => request<void>('DELETE', `/compare/lists/${encodeURIComponent(id)}`),
  addItem: (id: string, input: AddShoppingListItemInput) => request<ShoppingList>('POST', `/compare/lists/${encodeURIComponent(id)}/items`, input),
  updateItem: (id: string, itemId: string, input: UpdateShoppingListItemInput) =>
    request<ShoppingList>('PATCH', `/compare/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, input),
  removeItem: (id: string, itemId: string) =>
    request<ShoppingList>('DELETE', `/compare/lists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`),
  compareList: (id: string, input: Partial<BasketCompareInput>) =>
    request<BasketCompareResult>('POST', `/compare/lists/${encodeURIComponent(id)}/compare`, input),

  // ── Alerts en meldingen ──────────────────────────────────────────────────
  alerts: (input: Partial<AlertListQuery> = {}) => request<PriceAlert[]>('GET', `/compare/alerts${query(input)}`),
  alertPreview: (input: CreatePriceAlertInput) => request<AlertPreview>('POST', '/compare/alerts/preview', input),
  createAlert: (input: CreatePriceAlertInput) => request<PriceAlert>('POST', '/compare/alerts', input),
  alert: (id: string) => request<PriceAlert>('GET', `/compare/alerts/${encodeURIComponent(id)}`),
  updateAlert: (id: string, input: UpdatePriceAlertInput) => request<PriceAlert>('PATCH', `/compare/alerts/${encodeURIComponent(id)}`, input),
  pauseAlert: (id: string) => request<PriceAlert>('POST', `/compare/alerts/${encodeURIComponent(id)}/pause`),
  resumeAlert: (id: string) => request<PriceAlert>('POST', `/compare/alerts/${encodeURIComponent(id)}/resume`),
  deleteAlert: (id: string) => request<void>('DELETE', `/compare/alerts/${encodeURIComponent(id)}`),
  notifications: () => request<AlertNotification[]>('GET', '/compare/notifications'),
  markNotificationRead: (id: string) => request<void>('POST', `/compare/notifications/${encodeURIComponent(id)}/read`),
};
