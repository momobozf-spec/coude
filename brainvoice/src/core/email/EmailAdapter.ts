import type { EmailAddress, EmailDraft } from '../domain/admin';

/**
 * Email transport contracts. The domain never talks to IMAP/Gmail/Outlook directly:
 *  - `EmailAdapter` can sync messages into the local store and (optionally) send drafts;
 *  - `MailComposer` opens the system mail app with a pre-filled message so the user
 *    sends it themselves – the fallback when no sending adapter is connected and a
 *    natural "final confirmation" step for external communication (§96).
 * `LocalEmailAdapter` is what ships in v1: messages arrive by import (share sheet, paste,
 * manual entry); a Gmail/IMAP adapter can be added behind the same interface.
 */

export interface EmailMessageInput {
  externalId?: string | null;
  threadId?: string | null;
  account?: string | null;
  from: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  bodyText: string;
  receivedAt?: string | null;
  isFromMe?: boolean;
  isRead?: boolean;
  /** Which provider delivered the message ('local' by default). */
  providerId?: string | null;
}

export interface EmailAdapterCapabilities {
  canSync: boolean;
  canSend: boolean;
}

export interface EmailAdapter {
  readonly id: string;
  capabilities(): EmailAdapterCapabilities;
  /** Pulls new messages since the given ISO timestamp. */
  sync?(sinceISO: string | null): Promise<EmailMessageInput[]>;
  /** Sends a draft; only called after the user confirmed in the preview. */
  send?(draft: EmailDraft, options: { inReplyToExternalId: string | null }): Promise<{ externalId: string | null }>;
}

export interface MailComposer {
  isAvailable(): Promise<boolean>;
  /** Opens the system composer; resolves when the composer was presented (sending happens outside the app). */
  compose(draft: EmailDraft): Promise<'opened' | 'unavailable'>;
}

export class LocalEmailAdapter implements EmailAdapter {
  readonly id = 'local';
  capabilities(): EmailAdapterCapabilities {
    return { canSync: false, canSend: false };
  }
}

export class NullMailComposer implements MailComposer {
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async compose(): Promise<'opened' | 'unavailable'> {
    return 'unavailable';
  }
}
