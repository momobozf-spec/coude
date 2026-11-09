import type { EmailProvider } from '../email/EmailProvider';

/** Email account connection status shown in Settings → Alfred and System Health. */
export interface EmailAccountStatus {
  providerId: string;
  displayName: string;
  state: 'ready' | 'not_configured' | 'error';
  connected: boolean;
  email: string | null;
  detail: string | null;
  canList: boolean;
  canSend: boolean;
  /** True when the server can start an OAuth consent flow for this provider. */
  canConnect: boolean;
}

/** Server-side account management (OAuth flows); the app only sees the status and a consent URL. */
export interface EmailAccountManager {
  status(): Promise<EmailAccountStatus>;
  /** Returns the consent URL to open in the browser, or null when the provider has no OAuth flow. */
  connectUrl(): Promise<string | null>;
  disconnect(): Promise<void>;
}

export class ProviderOnlyAccountManager implements EmailAccountManager {
  constructor(private readonly provider: () => EmailProvider) {}

  async status(): Promise<EmailAccountStatus> {
    const provider = this.provider();
    const status = await provider.status().catch((e: unknown) => ({ state: 'error' as const, detail: e instanceof Error ? e.message : String(e) }));
    const caps = provider.capabilities();
    return { providerId: provider.id, displayName: provider.displayName, state: status.state, connected: status.state === 'ready', email: null, detail: status.detail, canList: caps.canList, canSend: caps.canSend, canConnect: false };
  }

  async connectUrl(): Promise<string | null> {
    return null;
  }

  async disconnect(): Promise<void> {}
}
