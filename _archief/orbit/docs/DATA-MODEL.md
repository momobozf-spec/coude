# Orbit — Datamodel

## Overzicht

```
User ──< Membership >── Workspace
                            │
                            ├──< Project ──< Item (project_id)
                            ├──< Tag ──< ItemTag >── Item
                            ├──< Item ─┬── TaskDetail ──< ChecklistItem
                            │          ├── NoteDetail
                            │          └── IdeaDetail
                            │          ├──< Reminder
                            │          ├──< Attachment
                            │          ├──< ItemLink (item ↔ item)
                            │          └──< Activity
                            └──< SyncOperation (idempotentie-log)
```

Alles hangt aan een `Workspace`. Een solo-gebruiker krijgt bij registratie automatisch een persoonlijke workspace, zodat teams later geen migratie vergen.

## Gedeelde kolommen (elke synchroniseerbare tabel)

| Kolom | Type | Doel |
|---|---|---|
| `id` | `char(26)` ULID | Client-generated, sorteerbaar op tijd |
| `workspaceId` | `char(26)` | Isolatiegrens; in élke index de eerste kolom |
| `createdAt` / `updatedAt` | `timestamptz` | |
| `deletedAt` | `timestamptz?` | Tombstone |
| `serverSeq` | `bigint` | Logische klok voor delta-sync |
| `revision` | `int` | Optimistic concurrency |

## Tabellen

### User
`id`, `email` (uniek, citext), `passwordHash?`, `name`, `avatarUrl?`, `locale`, `timeZone`, `emailVerifiedAt?`, `lastSeenAt?`, `createdAt`, `updatedAt`.
Wachtwoord is optioneel: een pure OAuth-gebruiker heeft er geen.

### AuthIdentity
OAuth-koppelingen. `userId`, `provider` (GOOGLE | APPLE | MICROSOFT), `providerAccountId`, uniek op `(provider, providerAccountId)`.

### Session
`id`, `userId`, `refreshTokenHash`, `familyId`, `parentId?`, `userAgent`, `ip`, `expiresAt`, `revokedAt?`, `replacedById?`.
Rotatie: een gebruikte refresh token wordt vervangen; wordt een ingetrokken token opnieuw aangeboden, dan wordt de hele `familyId` ingetrokken.

### Workspace
`id`, `name`, `slug`, `ownerId`, `personal` (bool), `settings` (jsonb).

### Membership
`workspaceId`, `userId`, `role` (OWNER | ADMIN | MEMBER | VIEWER), `joinedAt`. PK `(workspaceId, userId)`.

### Project
`id`, `workspaceId`, `name`, `description?`, `color`, `icon?`, `status` (PLANNING | ACTIVE | ON_HOLD | COMPLETED | ARCHIVED), `priority`, `startDate?`, `endDate?`, `sortKey`, `favorite`, `archivedAt?`.
`progress` wordt berekend, niet opgeslagen (afgeleide waarde uit de taken; caching gebeurt in de client).

### Item — de kern

| Kolom | Type | Opmerking |
|---|---|---|
| `type` | `TASK` \| `NOTE` \| `IDEA` | Discriminator |
| `title` | text | Verplicht voor alle types |
| `preview` | text | Eerste 200 tekens van de content, voor lijstweergaven |
| `projectId?` | fk | Null = geen project |
| `inInbox` | bool | Nog niet getrieerd |
| `favorite` | bool | |
| `archivedAt?` | timestamptz | |
| `sortKey` | text | Fractional indexing voor drag & drop |
| `capturedVia` | `MANUAL` \| `QUICK` \| `NLP` \| `IMPORT` \| `AI` | Voor analytics en AI-training |
| `searchVector` | tsvector | Generated, GIN-index |

### TaskDetail (1:1 met Item waar `type = TASK`)
`itemId` (PK), `description?`, `status` (TODO | IN_PROGRESS | DONE | CANCELLED), `priority` (NONE | LOW | MEDIUM | HIGH | URGENT), `dueDate?` (date), `dueTime?` (time), `startDate?`, `completedAt?`, `estimateMinutes?`, `recurrence?` (jsonb `RecurrenceRule`), `recurrenceParentId?`, `parentTaskId?` (subtaken).

### NoteDetail
`itemId` (PK), `content` (jsonb, blok-array), `plainText` (afgeleid, voor search), `folderId?`, `pinned`, `lastEditedAt`.

### IdeaDetail
`itemId` (PK), `description?`, `category?`, `status` (NEW | EXPLORING | INTERESTING | LATER | DEVELOPING | CONVERTED | REJECTED | ARCHIVED), `impact?` 1-5, `effort?` 1-5, `convertedToProjectId?`, `sourceUrl?`.

### ChecklistItem
`id`, `itemId`, `text`, `done`, `doneAt?`, `sortKey`. Werkt op zowel taken als notities.

### Tag
`id`, `workspaceId`, `name`, `slug`, `color`, `usageCount`. Uniek op `(workspaceId, slug)`.

### ItemTag
`(itemId, tagId)` PK, plus `workspaceId` voor scoping en `createdAt`.

### Reminder
`id`, `itemId`, `remindAt` (timestamptz, absoluut, in UTC), `offsetMinutes?` (relatief tot due), `channel` (PUSH | LOCAL | EMAIL), `status` (SCHEDULED | SENT | DISMISSED | FAILED), `sentAt?`.

### Attachment
`id`, `itemId`, `fileName`, `mimeType`, `sizeBytes`, `storageKey`, `checksum`, `uploadedById`, `width?`, `height?`.

### ItemLink
`(fromItemId, toItemId, kind)`. Kinds: `RELATED`, `BLOCKS`, `DERIVED_FROM` (idee → taak-conversie), `MENTIONS` (notitie-backlinks).

### NoteFolder
`id`, `workspaceId`, `name`, `parentId?`, `icon`, `sortKey`. Werk / Persoonlijk / Business / Ideeën / Projecten worden bij registratie aangemaakt.

### Activity
`id`, `workspaceId`, `actorId`, `entityType`, `entityId`, `action`, `payload` (jsonb), `createdAt`. Dubbelt als audit log.

### SyncOperation
`operationId` (PK, ULID van de client), `workspaceId`, `deviceId`, `appliedAt`, `resultHash`. Maakt push idempotent. TTL van 30 dagen.

### Device
`id`, `userId`, `platform` (IOS | ANDROID | WEB), `pushToken?`, `lastSyncSeq`, `lastSeenAt`.

## Indexen (afgeleid van de views)

| View | Index |
|---|---|
| Vandaag / Achterstallig / Komend | `task_details (workspace_id, status, due_date) WHERE deleted_at IS NULL` |
| Inbox | `items (workspace_id, in_inbox, created_at DESC) WHERE deleted_at IS NULL` |
| Project-detail | `items (workspace_id, project_id, type, sort_key)` |
| Delta-sync | `items (workspace_id, server_seq)` — op elke sync-tabel |
| Zoeken | `GIN (search_vector)` |
| Tag-filter | `item_tags (workspace_id, tag_id, item_id)` |
| Reminder-scheduler | `reminders (status, remind_at) WHERE status = 'SCHEDULED'` |
| Favorieten | `items (workspace_id, favorite, updated_at DESC) WHERE favorite` |

## Waarom afgeleide waarden niet worden opgeslagen

`project.progress`, `tag.usageCount` en `item.preview` zijn de klassieke bronnen van sync-drift: twee devices die tegelijk een taak afvinken produceren twee verschillende tellers. Alleen `preview` en `plainText` worden opgeslagen (ze zijn een pure functie van `content` in dezelfde rij, dus conflictvrij). `progress` en `usageCount` worden per query berekend en client-side gecached.
