import type { NotificationAdapter } from '../commands/adapters';
import { LocalEmailAdapter, NullMailComposer, type EmailAdapter, type MailComposer } from '../email/EmailAdapter';

/**
 * Platform capabilities the Butler tools need beyond the capture adapters: email
 * transport, the system mail composer and PDF rendering. All optional – tools degrade
 * gracefully (HTML share instead of PDF, composer instead of direct send).
 */

export interface PdfRenderer {
  isAvailable(): Promise<boolean>;
  /** Renders HTML to a PDF file and returns its URI. */
  render(html: string, fileName: string): Promise<{ uri: string }>;
}

export class UnavailablePdfRenderer implements PdfRenderer {
  async isAvailable(): Promise<boolean> {
    return false;
  }
  async render(): Promise<{ uri: string }> {
    throw new Error('PDF rendering unavailable');
  }
}

export interface ButlerAdapters {
  email: EmailAdapter;
  mailComposer: MailComposer;
  pdf: PdfRenderer;
  notifications: NotificationAdapter | null;
}

export function createDefaultButlerAdapters(): ButlerAdapters {
  return { email: new LocalEmailAdapter(), mailComposer: new NullMailComposer(), pdf: new UnavailablePdfRenderer(), notifications: null };
}
