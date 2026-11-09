import type { IconName } from '@/components/icons';

/**
 * De navigatie staat één keer beschreven en wordt gedeeld door de sidebar op
 * desktop, de tabbar op mobiel en het commandopalet. Een pagina toevoegen
 * gebeurt hier, niet op drie plekken.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Sneltoets binnen de `g`-reeks: `g` gevolgd door deze letter. */
  shortcut?: string;
  /** Toont een teller, bijvoorbeeld het aantal taken van vandaag. */
  counter?: 'today' | 'inbox' | 'overdue';
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overzicht',
    items: [
      { href: '/', label: 'Home', icon: 'home', shortcut: 'h' },
      { href: '/inbox', label: 'Inbox', icon: 'inbox', shortcut: 'i', counter: 'inbox' },
      { href: '/vandaag', label: 'Vandaag', icon: 'sun', shortcut: 'd', counter: 'today' },
      { href: '/komend', label: 'Komend', icon: 'calendar-days', shortcut: 'u' },
    ],
  },
  {
    id: 'werk',
    label: 'Werken',
    items: [
      { href: '/taken', label: 'Taken', icon: 'check-circle', shortcut: 't' },
      { href: '/notities', label: 'Notities', icon: 'note', shortcut: 'n' },
      { href: '/ideeen', label: 'Ideeën', icon: 'lightbulb', shortcut: 'e' },
    ],
  },
  {
    id: 'organisatie',
    label: 'Organiseren',
    items: [
      { href: '/projecten', label: 'Projecten', icon: 'folder', shortcut: 'p' },
      { href: '/kalender', label: 'Kalender', icon: 'calendar', shortcut: 'k' },
      { href: '/tags', label: 'Tags', icon: 'tag', shortcut: 'g' },
    ],
  },
];

/** De vijf posities van de mobiele tabbar; het midden is de quick capture. */
export const MOBILE_TABS: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/taken', label: 'Taken', icon: 'check-circle' },
  { href: '/notities', label: 'Notities', icon: 'note' },
  { href: '/meer', label: 'Meer', icon: 'menu' },
];

/** Wat er onder "Meer" zit op mobiel; op desktop staat dit gewoon in de sidebar. */
export const MORE_ITEMS: NavItem[] = [
  { href: '/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/ideeen', label: 'Ideeën', icon: 'lightbulb' },
  { href: '/projecten', label: 'Projecten', icon: 'folder' },
  { href: '/kalender', label: 'Kalender', icon: 'calendar' },
  { href: '/tags', label: 'Tags', icon: 'tag' },
  { href: '/zoeken', label: 'Zoeken', icon: 'search' },
  { href: '/instellingen', label: 'Instellingen', icon: 'settings' },
];

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  { href: '/instellingen', label: 'Instellingen', icon: 'settings' },
  { href: '/zoeken', label: 'Zoeken', icon: 'search' },
];

/** Bepaalt of een navigatie-item actief is voor het huidige pad. */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
