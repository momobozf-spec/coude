import {
  BlockType,
  IdeaStatus,
  ItemType,
  TaskStatus,
  type IdeaDetail,
  type Item,
  type ItemType as ItemTypeValue,
  type NoteContent,
  type NoteDetail,
  type TaskDetail,
} from '@orbit/types';
import { toPreview, ulid } from '@orbit/utils';
import { noteContentToPlainText, spansToText } from '../notes/content';

/**
 * Conversie tussen taak, notitie en idee.
 *
 * Dit is de reden dat het datamodel één `Item` met type-extensies gebruikt: het
 * item houdt zijn id, dus tags, bijlagen, projectkoppeling, backlinks en het
 * activiteitenlog blijven allemaal staan. Alleen het detailrecord wisselt.
 *
 * De inhoud gaat mee waar dat betekenis heeft: de beschrijving van een taak
 * wordt de tekst van de notitie, en checklistvinkjes in een notitie worden
 * echte checklist-items op de taak. Zonder die vertaling zou een conversie
 * aanvoelen als informatieverlies, en dan gebruikt niemand hem.
 */

export interface ChecklistDraft {
  text: string;
  done: boolean;
}

export interface ConversionPlan {
  fromType: ItemTypeValue;
  toType: ItemTypeValue;
  /** Het detailrecord dat verdwijnt. */
  removeDetailFor: ItemTypeValue;
  task?: Partial<TaskDetail>;
  note?: Partial<NoteDetail>;
  idea?: Partial<IdeaDetail>;
  /** Nieuwe waarde voor `items.preview`. */
  preview: string;
  /** Checklist-items die uit de content zijn gedestilleerd. */
  checklist?: ChecklistDraft[];
  /** Checklist die verdwijnt omdat hij in de content is opgenomen. */
  clearChecklist: boolean;
}

function textToBlocks(text: string | null): NoteContent {
  if (!text?.trim()) return [{ id: ulid(), type: BlockType.Paragraph, spans: [] }];
  return text.split('\n').map((line) => ({
    id: ulid(),
    type: BlockType.Paragraph,
    spans: line ? [{ text: line }] : [],
  }));
}

function checklistToBlocks(checklist: readonly ChecklistDraft[]): NoteContent {
  return checklist.map((entry) => ({
    id: ulid(),
    type: BlockType.ChecklistItem,
    spans: [{ text: entry.text }],
    checked: entry.done,
  }));
}

function extractChecklist(content: NoteContent): ChecklistDraft[] {
  return content
    .filter((block) => block.type === BlockType.ChecklistItem)
    .map((block) => ({ text: spansToText(block.spans), done: block.checked ?? false }))
    .filter((entry) => entry.text.trim().length > 0);
}

/** De tekstuele inhoud van een item, ongeacht het type. */
export function bodyTextOf(item: Item, checklist: readonly ChecklistDraft[] = []): string {
  switch (item.type) {
    case ItemType.Task: {
      const parts = [item.task.description ?? ''];
      if (checklist.length > 0) {
        parts.push(checklist.map((entry) => `${entry.done ? '[x]' : '[ ]'} ${entry.text}`).join('\n'));
      }
      return parts.filter(Boolean).join('\n\n');
    }
    case ItemType.Note:
      return noteContentToPlainText(item.note.content);
    case ItemType.Idea:
      return item.idea.description ?? '';
  }
}

export function planConversion(
  item: Item,
  toType: ItemTypeValue,
  checklist: readonly ChecklistDraft[] = [],
): ConversionPlan {
  if (item.type === toType) {
    throw new Error(`Item is al van het type ${toType}`);
  }

  const base = { fromType: item.type, toType, removeDetailFor: item.type, clearChecklist: false };

  // --- Naar notitie -------------------------------------------------------
  if (toType === ItemType.Note) {
    const body =
      item.type === ItemType.Task
        ? item.task.description
        : item.type === ItemType.Idea
          ? item.idea.description
          : null;
    const blocks = [
      ...textToBlocks(body),
      // Een checklist op een taak wordt een checklist ín de notitie; het item
      // houdt geen losse checklist-rijen meer over.
      ...checklistToBlocks(checklist),
    ];
    const plainText = noteContentToPlainText(blocks);
    return {
      ...base,
      note: {
        content: blocks,
        plainText,
        folderId: null,
        pinned: false,
      },
      preview: toPreview(plainText),
      clearChecklist: checklist.length > 0,
    };
  }

  // --- Naar taak ----------------------------------------------------------
  if (toType === ItemType.Task) {
    if (item.type === ItemType.Note) {
      const extracted = extractChecklist(item.note.content);
      // De niet-checklistregels worden de beschrijving; de vinkjes worden echte
      // checklist-items, zodat je ze in de takenlijst kunt afvinken.
      const description = noteContentToPlainText(
        item.note.content.filter((block) => block.type !== BlockType.ChecklistItem),
      );
      return {
        ...base,
        task: {
          description: description || null,
          status: TaskStatus.Todo,
          priority: 'NONE',
          dueDate: null,
          dueTime: null,
          completedAt: null,
          recurrence: null,
          parentTaskId: null,
        },
        preview: toPreview(description),
        checklist: extracted,
        clearChecklist: false,
      };
    }

    const description = item.type === ItemType.Idea ? item.idea.description : null;
    return {
      ...base,
      task: {
        description,
        status: TaskStatus.Todo,
        priority: 'NONE',
        dueDate: null,
        dueTime: null,
        completedAt: null,
        recurrence: null,
        parentTaskId: null,
      },
      preview: toPreview(description ?? ''),
      clearChecklist: false,
    };
  }

  // --- Naar idee ----------------------------------------------------------
  const description =
    item.type === ItemType.Note ? noteContentToPlainText(item.note.content) : bodyTextOf(item, checklist);

  return {
    ...base,
    idea: {
      description: description || null,
      status: IdeaStatus.New,
      category: null,
      impact: null,
      effort: null,
      sourceUrl: null,
    },
    preview: toPreview(description),
    clearChecklist: item.type === ItemType.Task && checklist.length > 0,
  };
}

/** Welke conversies de UI aanbiedt vanuit een gegeven type. */
export function conversionTargets(from: ItemTypeValue): ItemTypeValue[] {
  return [ItemType.Task, ItemType.Note, ItemType.Idea].filter((type) => type !== from);
}

export const CONVERSION_LABELS: Record<ItemTypeValue, string> = {
  TASK: 'Omzetten naar taak',
  NOTE: 'Omzetten naar notitie',
  IDEA: 'Omzetten naar idee',
};
