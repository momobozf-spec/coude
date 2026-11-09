import {
  ErrorCode,
  type ApiErrorBody,
  type ChecklistItem,
  type DashboardSummary,
  type Item,
  type ItemFilter,
  type ItemListEntry,
  type Page,
  type Project,
  type ProjectWithProgress,
  type SortSpec,
  type TagWithUsage,
  type TaskView,
  type User,
  type Workspace,
} from '@orbit/types';

/**
 * De typed API-client, gedeeld door web en mobiel.
 *
 * Hij weet niets van React of van opslag: tokens komen uit een `TokenStore`
 * die het platform aanlevert (httpOnly-cookies op web, SecureStore op mobiel).
 * Zo blijft dezelfde client bruikbaar in een Node-script of een test.
 */

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: { path: string; message: string }[],
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Fouten die vanzelf overgaan; alleen die zijn het herhalen waard. */
  get isRetryable(): boolean {
    return this.code === ErrorCode.RateLimited || this.status >= 500;
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}

/** Web gebruikt cookies; dan hoeft de client geen tokens te beheren. */
export const cookieTokenStore: TokenStore = {
  async get() {
    return null;
  },
  async set() {
    /* de server zet de cookies */
  },
  async clear() {
    /* de server wist de cookies */
  },
};

export interface ClientOptions {
  baseUrl: string;
  tokens?: TokenStore;
  workspaceId?: () => string | null;
  deviceId?: () => string | null;
  /** Injecteerbaar voor tests. */
  fetchImpl?: typeof fetch;
  onUnauthenticated?: () => void;
}

export class OrbitClient {
  private refreshing: Promise<Tokens | null> | null = null;

  constructor(private readonly options: ClientOptions) {}

  private get fetch(): typeof fetch {
    return this.options.fetchImpl ?? globalThis.fetch;
  }

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    const tokens = await this.options.tokens?.get();
    if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

    const workspaceId = this.options.workspaceId?.();
    if (workspaceId) headers['x-workspace-id'] = workspaceId;

    const deviceId = this.options.deviceId?.();
    if (deviceId) headers['x-device-id'] = deviceId;

    return headers;
  }

  /**
   * Eén verzoek, met één automatische hertrypoging na het verversen van het
   * access token. Meer dan één keer proberen heeft geen zin: als de tweede
   * poging ook 401 geeft, is de sessie echt weg.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retry = true,
  ): Promise<T> {
    const response = await this.fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers: await this.headers(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'include',
    });

    if (response.status === 401 && retry) {
      const refreshed = await this.refreshTokens();
      if (refreshed !== null) return this.request<T>(method, path, body, false);
      this.options.onUnauthenticated?.();
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        payload?.error?.code ?? ErrorCode.Internal,
        payload?.error?.message ?? `Verzoek mislukt (${response.status})`,
        response.status,
        payload?.error?.fields,
        payload?.error?.retryAfter,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Meerdere gelijktijdige 401's mogen samen maar één refresh veroorzaken. */
  private async refreshTokens(): Promise<Tokens | null> {
    this.refreshing ??= (async () => {
      try {
        const stored = await this.options.tokens?.get();
        const response = await this.fetch(`${this.options.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(stored ? { refreshToken: stored.refreshToken } : {}),
          credentials: 'include',
        });
        if (!response.ok) {
          await this.options.tokens?.clear();
          return null;
        }
        const tokens = (await response.json()) as Tokens;
        await this.options.tokens?.set(tokens);
        return tokens;
      } catch {
        return null;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async login(input: { email: string; password: string; platform?: string; deviceName?: string }) {
    const result = await this.request<AuthResponse>('POST', '/api/auth/login', {
      platform: 'WEB',
      ...input,
    });
    await this.options.tokens?.set(result);
    return result;
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
    timeZone?: string;
    platform?: string;
  }) {
    const result = await this.request<AuthResponse>('POST', '/api/auth/register', {
      platform: 'WEB',
      ...input,
    });
    await this.options.tokens?.set(result);
    return result;
  }

  async logout(allDevices = false) {
    await this.request('POST', `/api/auth/logout?allDevices=${allDevices}`);
    await this.options.tokens?.clear();
  }

  me() {
    return this.request<{ user: User; workspaces: { workspace: Workspace; role: string }[]; currentWorkspaceId: string }>(
      'GET',
      '/api/me',
    );
  }

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  listItems(query: { filter?: ItemFilter; sort?: SortSpec; cursor?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (query.filter) params.set('filter', JSON.stringify(query.filter));
    if (query.sort) params.set('sort', JSON.stringify(query.sort));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.limit) params.set('limit', String(query.limit));
    return this.request<Page<ItemListEntry>>('GET', `/api/items?${params.toString()}`);
  }

  listView(view: TaskView, query: { cursor?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.limit) params.set('limit', String(query.limit));
    return this.request<Page<ItemListEntry>>('GET', `/api/views/${view}?${params.toString()}`);
  }

  getItem(itemId: string) {
    return this.request<{
      item: Item;
      tagIds: string[];
      checklist: ChecklistItem[];
      subtasks: Item[];
    }>('GET', `/api/items/${itemId}`);
  }

  createItem(input: unknown) {
    return this.request<{ item: Item }>('POST', '/api/items', input);
  }

  updateItem(itemId: string, input: unknown) {
    return this.request<{ item: Item }>('PATCH', `/api/items/${itemId}`, input);
  }

  deleteItem(itemId: string) {
    return this.request<{ ok: true }>('DELETE', `/api/items/${itemId}`);
  }

  completeTask(itemId: string, completed: boolean, completedAt = new Date().toISOString()) {
    return this.request<{ item: Item; rescheduled: boolean; nextDueDate: string | null }>(
      'POST',
      `/api/items/${itemId}/complete`,
      { completed, completedAt },
    );
  }

  convertItem(itemId: string, targetType: string, keepBacklink = true) {
    return this.request<{ item: Item }>('POST', `/api/items/${itemId}/convert`, {
      targetType,
      keepBacklink,
    });
  }

  quickCapture(input: { text: string; type?: string; body?: string; projectId?: string | null }) {
    return this.request<{ item: Item; createdTagIds: string[]; createdProjectId: string | null }>(
      'POST',
      '/api/items/quick-capture',
      input,
    );
  }

  setChecklistItem(checklistItemId: string, done: boolean) {
    return this.request<{ checklistItem: ChecklistItem }>('PATCH', `/api/checklist/${checklistItemId}`, {
      done,
    });
  }

  bulkAction(input: unknown) {
    return this.request<{ affected: number }>('POST', '/api/items/bulk', input);
  }

  // -------------------------------------------------------------------------
  // Overzichten
  // -------------------------------------------------------------------------

  dashboard() {
    return this.request<{
      summary: DashboardSummary;
      today: ItemListEntry[];
      overdue: ItemListEntry[];
      recentNotes: Item[];
      recentIdeas: Item[];
      projects: ProjectWithProgress[];
      date: string;
    }>('GET', '/api/dashboard');
  }

  tags() {
    return this.request<{ tags: TagWithUsage[] }>('GET', '/api/tags');
  }

  projects() {
    return this.request<{ projects: ProjectWithProgress[] }>('GET', '/api/projects');
  }

  createProject(input: unknown) {
    return this.request<{ project: Project }>('POST', '/api/projects', input);
  }
}

export interface AuthResponse extends Tokens {
  user: User;
  workspace: Workspace;
  workspaces: { workspace: Workspace; role: string }[];
  deviceId: string;
}

export function createClient(options: ClientOptions): OrbitClient {
  return new OrbitClient(options);
}
