import type { ItemFilter, TaskView } from '@orbit/types';

/**
 * De sleutels van de query-cache, op één plek.
 *
 * Een mutatie moet precies weten wat ze ongeldig maakt. Losse strings door de
 * codebase heen leiden onvermijdelijk tot een scherm dat na een wijziging niet
 * ververst — en dat is de bug waar niemand een reproductie voor kan geven.
 */
export const queryKeys = {
  all: ['orbit'] as const,

  me: () => [...queryKeys.all, 'me'] as const,

  dashboard: () => [...queryKeys.all, 'dashboard'] as const,

  items: () => [...queryKeys.all, 'items'] as const,
  itemList: (filter: ItemFilter) => [...queryKeys.items(), 'list', filter] as const,
  itemView: (view: TaskView) => [...queryKeys.items(), 'view', view] as const,
  item: (itemId: string) => [...queryKeys.items(), 'detail', itemId] as const,

  tags: () => [...queryKeys.all, 'tags'] as const,
  projects: () => [...queryKeys.all, 'projects'] as const,
  project: (projectId: string) => [...queryKeys.projects(), projectId] as const,
} as const;

/**
 * Wat er opnieuw opgehaald moet worden na een itemmutatie. Bewust ruim: een
 * taak afvinken raakt de lijst, het dashboard én de projectvoortgang.
 */
export function itemMutationKeys(itemId?: string) {
  return [
    queryKeys.items(),
    queryKeys.dashboard(),
    queryKeys.projects(),
    ...(itemId ? [queryKeys.item(itemId)] : []),
  ];
}
