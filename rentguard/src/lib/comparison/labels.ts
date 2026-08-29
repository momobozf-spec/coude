import type { Locale } from '@/i18n/config';
import { ROOM_PRESETS, isCustomRoom, slotFor, slotLabel } from '@/lib/inspections/rooms';

/**
 * Leesbare namen voor kamer- en fotosleutels.
 *
 * De sleutels zelf zijn taalonafhankelijk; alleen de weergave hangt van de taal
 * af. Een onbekende sleutel wordt teruggegeven zoals hij is, in plaats van een
 * lege string te tonen.
 */

export function roomDisplayName(roomKey: string, locale: Locale): string {
  const preset = ROOM_PRESETS.find((item) => item.key === roomKey);
  if (preset) return preset[locale];

  if (isCustomRoom(roomKey)) {
    return roomKey
      .slice('custom:'.length)
      .replace(/_\d+$/, '')
      .replace(/_/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }

  return roomKey;
}

export function slotDisplayName(label: string, locale: Locale): string {
  const slot = slotFor(label);
  return slot ? slotLabel(slot, locale) : label;
}
