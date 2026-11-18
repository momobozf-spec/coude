/**
 * Ingebouwde, indicatieve referentietabel voor OS-versies.
 *
 * De app kan niet zien of er voor dit toestel een update klaarstaat; hij vergelijkt
 * alleen de hoofdversie met deze tabel. Werk de tabel bij wanneer er nieuwe
 * hoofdversies uitkomen of oude versies geen beveiligingsupdates meer krijgen.
 *
 * Laatst nagekeken: november 2026.
 */
export const OS_REFERENCE = {
  reviewedOn: 'november 2026',
  android: {
    /** Vanaf deze hoofdversie: recent genoeg. */
    goodFrom: 14,
    /** Vanaf deze hoofdversie (en lager dan goodFrom): extra aandacht. Lager: lijkt verouderd. */
    attentionFrom: 12,
  },
  ios: {
    // Let op: Apple ging in 2025 van iOS 18 naar iOS 26.
    goodFrom: 18,
    attentionFrom: 17,
  },
} as const;
