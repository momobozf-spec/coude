import {
  ActivityAction,
  AuthProvider,
  BlockType,
  CaptureSource,
  EntityType,
  IdeaStatus,
  ItemType,
  LinkKind,
  MemberRole,
  OperationKind,
  Platform,
  Priority,
  ProjectStatus,
  RecurrenceAnchor,
  RecurrenceFreq,
  ReminderChannel,
  ReminderStatus,
  SortDirection,
  SortField,
  SyncEntity,
  TaskStatus,
  TextMark,
  ThemePreference,
  Weekday,
} from '@orbit/types';
import { z } from 'zod';

/**
 * De `as const`-objecten uit @orbit/types zijn de enige bron; deze schemas
 * leiden er rechtstreeks uit af. Een nieuwe status toevoegen gebeurt dus
 * precies één keer.
 */

export const itemTypeSchema = z.nativeEnum(ItemType);
export const taskStatusSchema = z.nativeEnum(TaskStatus);
export const prioritySchema = z.nativeEnum(Priority);
export const ideaStatusSchema = z.nativeEnum(IdeaStatus);
export const projectStatusSchema = z.nativeEnum(ProjectStatus);
export const captureSourceSchema = z.nativeEnum(CaptureSource);
export const reminderChannelSchema = z.nativeEnum(ReminderChannel);
export const reminderStatusSchema = z.nativeEnum(ReminderStatus);
export const memberRoleSchema = z.nativeEnum(MemberRole);
export const authProviderSchema = z.nativeEnum(AuthProvider);
export const platformSchema = z.nativeEnum(Platform);
export const linkKindSchema = z.nativeEnum(LinkKind);
export const activityActionSchema = z.nativeEnum(ActivityAction);
export const entityTypeSchema = z.nativeEnum(EntityType);
export const themePreferenceSchema = z.nativeEnum(ThemePreference);
export const recurrenceFreqSchema = z.nativeEnum(RecurrenceFreq);
export const recurrenceAnchorSchema = z.nativeEnum(RecurrenceAnchor);
export const weekdaySchema = z.nativeEnum(Weekday);
export const blockTypeSchema = z.nativeEnum(BlockType);
export const textMarkSchema = z.nativeEnum(TextMark);
export const sortFieldSchema = z.nativeEnum(SortField);
export const sortDirectionSchema = z.nativeEnum(SortDirection);
export const syncEntitySchema = z.nativeEnum(SyncEntity);
export const operationKindSchema = z.nativeEnum(OperationKind);
