import { MemberRole, type DeviceId, type UserId, type WorkspaceId } from '@orbit/types';
import type { Transactional } from './client';
import { forbidden } from './errors';

/**
 * Elke repository-functie krijgt deze context. De `workspaceId` is geen optionele
 * parameter maar onderdeel van de context, waardoor een query zonder scoping
 * simpelweg niet te schrijven valt. Dat is de belangrijkste verdediging tegen
 * datalekken tussen gebruikers (ARCHITECTURE.md par. 6).
 */
export interface Scope {
  db: Transactional;
  userId: UserId;
  workspaceId: WorkspaceId;
  role: MemberRole;
  now: Date;
  deviceId?: DeviceId;
  /**
   * De voorkeuren van de gebruiker reizen mee in de scope in plaats van per
   * use-case opnieuw opgehaald te worden. "Vandaag" is een tijdzonevraag, en
   * die mag geen extra query per lijstweergave kosten.
   */
  timeZone: string;
  weekStartsOn: 0 | 1;
  showCompleted: boolean;
}

const WRITE_ROLES: readonly MemberRole[] = [MemberRole.Owner, MemberRole.Admin, MemberRole.Member];
const ADMIN_ROLES: readonly MemberRole[] = [MemberRole.Owner, MemberRole.Admin];

export function canWrite(scope: Scope): boolean {
  return WRITE_ROLES.includes(scope.role);
}

export function assertCanWrite(scope: Scope): void {
  if (!canWrite(scope)) throw forbidden('Je hebt alleen leesrechten in deze workspace');
}

export function assertCanAdmin(scope: Scope): void {
  if (!ADMIN_ROLES.includes(scope.role)) {
    throw forbidden('Alleen beheerders kunnen dit doen');
  }
}

/** De `where`-clausule die aan elke query wordt geplakt. */
export function scoped(scope: Scope): { workspaceId: WorkspaceId; deletedAt: null } {
  return { workspaceId: scope.workspaceId, deletedAt: null };
}

/** Inclusief tombstones; alleen de sync-laag heeft dit nodig. */
export function scopedWithDeleted(scope: Scope): { workspaceId: WorkspaceId } {
  return { workspaceId: scope.workspaceId };
}
