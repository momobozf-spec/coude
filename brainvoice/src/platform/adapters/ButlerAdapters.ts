import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import type { ButlerAdapters, PdfRenderer } from '@core/butler/adapters';
import type { NotificationAdapter } from '@core/commands/adapters';
import type { EmailDraft } from '@core/domain/admin';
import { LocalEmailAdapter, type MailComposer } from '@core/email/EmailAdapter';
import type { ReminderScheduler } from '@core/services/admin/ReminderScheduler';
import type { ReminderService } from '@core/services/ScheduleServices';
import type { Language } from '@core/types/common';

/**
 * Platform implementations of the Butler capabilities (spec §96, §102, §110):
 *  - mail composer: opens the system mail app with the draft pre-filled (the user presses
 *    Send there, which is the final confirmation for external communication);
 *  - PDF rendering through expo-print (HTML → PDF file in the app sandbox);
 *  - reminders that also schedule a local notification.
 * A real IMAP/Gmail `EmailAdapter` can replace `LocalEmailAdapter` later without touching the core.
 */

export class LinkingMailComposer implements MailComposer {
  async isAvailable(): Promise<boolean> {
    try {
      return await Linking.canOpenURL('mailto:someone@example.com');
    } catch {
      return false;
    }
  }

  async compose(draft: EmailDraft): Promise<'opened' | 'unavailable'> {
    const to = draft.to.map((a) => a.email).join(',');
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    try {
      if (!(await Linking.canOpenURL(url))) return 'unavailable';
      await Linking.openURL(url);
      return 'opened';
    } catch {
      return 'unavailable';
    }
  }
}

export class ExpoPrintPdfRenderer implements PdfRenderer {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async render(html: string, _fileName: string): Promise<{ uri: string }> {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { uri };
  }
}

/** Opens the share sheet for a generated file (PDF) when sharing is available on the device. */
export async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
    return true;
  } catch {
    return false;
  }
}

export function createButlerAdapters(notifications: NotificationAdapter): ButlerAdapters {
  return { email: new LocalEmailAdapter(), mailComposer: new LinkingMailComposer(), pdf: new ExpoPrintPdfRenderer(), notifications };
}

const REMINDER_BODY: Record<Language, string> = { en: 'Administrative reminder', nl: 'Administratieve herinnering', fr: 'Rappel administratif' };

/** Reminder scheduler that stores the reminder and schedules a time-sensitive notification. */
export function createNotificationReminderScheduler(reminders: ReminderService, notifications: NotificationAdapter, language: () => Language): ReminderScheduler {
  return async (request) => {
    let notificationId: string | null = null;
    try {
      const permission = (await notifications.getPermission()) === 'granted' ? 'granted' : await notifications.requestPermission();
      if (permission === 'granted') notificationId = await notifications.schedule({ title: request.title, body: request.notes ?? REMINDER_BODY[language()], fireISO: request.dueISO, categoryId: 'reminder', timeSensitive: true });
    } catch {
      notificationId = null;
    }
    const reminder = await reminders.create({ title: request.title, notes: request.notes ?? null, dueAt: request.dueISO, recurrence: null, backend: notificationId ? 'notification' : 'none', externalId: null, notificationId, captureId: null });
    return { reminderId: reminder.id, notificationId };
  };
}
