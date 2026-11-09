/**
 * Alle identifiers zijn ULIDs (26 tekens, Crockford base32, lexicografisch
 * sorteerbaar op aanmaaktijd). Ze worden op de client gegenereerd zodat je
 * offline al relaties tussen nieuwe objecten kunt leggen.
 */
export type Ulid = string;

export type UserId = Ulid;
export type WorkspaceId = Ulid;
export type ProjectId = Ulid;
export type ItemId = Ulid;
export type TagId = Ulid;
export type ReminderId = Ulid;
export type AttachmentId = Ulid;
export type ChecklistItemId = Ulid;
export type ActivityId = Ulid;
export type SessionId = Ulid;
export type DeviceId = Ulid;
export type NoteFolderId = Ulid;
export type OperationId = Ulid;

/** ISO-8601 timestamp met tijdzone, bijvoorbeeld `2026-08-25T09:30:00.000Z`. */
export type IsoDateTime = string;

/** Kalenderdatum zonder tijd, bijvoorbeeld `2026-08-25`. Bewust tijdzone-loos. */
export type IsoDate = string;

/** Lokale tijd zonder datum, bijvoorbeeld `14:00`. */
export type IsoTime = string;

/**
 * Monotoon oplopende logische klok per workspace. Als string weergegeven omdat
 * het aan serverzijde een bigint is en JSON geen bigint kent.
 */
export type ServerSeq = string;

export const ULID_LENGTH = 26;
