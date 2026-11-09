import {
  BlockType,
  type NoteBlock,
  type NoteContent,
  type ItemId,
  type RichSpan,
} from '@orbit/types';
import { toPreview, ulid } from '@orbit/utils';

/** Hulpmiddelen rond de blokstructuur van notities. */

export function createBlock(type: BlockType, text = ''): NoteBlock {
  return {
    id: ulid(),
    type,
    spans: text ? [{ text }] : [],
  };
}

export function emptyNoteContent(): NoteContent {
  return [createBlock(BlockType.Paragraph)];
}

export function spansToText(spans: readonly RichSpan[] | undefined): string {
  return (spans ?? []).map((span) => span.text).join('');
}

/** Platte tekst voor zoeken en previews. Behoudt de regelstructuur. */
export function noteContentToPlainText(content: NoteContent): string {
  const lines: string[] = [];
  for (const block of content) {
    switch (block.type) {
      case BlockType.Divider:
        lines.push('---');
        break;
      case BlockType.Table:
        for (const row of block.rows ?? []) {
          lines.push(row.cells.map((cell) => spansToText(cell.spans)).join(' | '));
        }
        break;
      case BlockType.ChecklistItem:
        lines.push(`${block.checked ? '[x]' : '[ ]'} ${spansToText(block.spans)}`);
        break;
      case BlockType.BulletItem:
        lines.push(`- ${spansToText(block.spans)}`);
        break;
      default:
        lines.push(spansToText(block.spans));
    }
  }
  return lines.join('\n').trim();
}

export function noteContentToPreview(content: NoteContent): string {
  return toPreview(noteContentToPlainText(content));
}

/** Titel afleiden uit de eerste betekenisvolle regel, zoals Apple Notes doet. */
export function deriveNoteTitle(content: NoteContent, fallback: string): string {
  for (const block of content) {
    const text = spansToText(block.spans).trim();
    if (text.length > 0) return text.slice(0, 120);
  }
  return fallback;
}

/** Alle items waar deze notitie naar linkt; voedt de backlink-index. */
export function extractLinkedItemIds(content: NoteContent): ItemId[] {
  const ids = new Set<ItemId>();
  for (const block of content) {
    if (block.itemId) ids.add(block.itemId);
    for (const span of block.spans ?? []) {
      if (span.itemId) ids.add(span.itemId);
    }
  }
  return [...ids];
}

export function countWords(content: NoteContent): number {
  const text = noteContentToPlainText(content);
  return text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
}

/** Checklist-blokken binnen een notitie; de UI toont hier voortgang op. */
export function checklistProgress(content: NoteContent): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const block of content) {
    if (block.type === BlockType.ChecklistItem) {
      total++;
      if (block.checked) done++;
    }
  }
  return { total, done };
}

/**
 * Merge van twee versies van dezelfde notitie, per blok.
 *
 * Dit is wat voorkomt dat twee devices elkaars werk overschrijven: blokken die
 * maar aan één kant zijn aangeraakt blijven behouden, en alleen bij een blok dat
 * aan beide kanten is gewijzigd wint de nieuwste `updatedAt`.
 */
export function mergeNoteContent(
  base: NoteContent,
  local: NoteContent,
  remote: NoteContent,
): NoteContent {
  const baseById = new Map(base.map((block) => [block.id, block]));
  const localById = new Map(local.map((block) => [block.id, block]));
  const remoteById = new Map(remote.map((block) => [block.id, block]));

  const merged: NoteBlock[] = [];
  const seen = new Set<string>();

  // De volgorde van de remote is leidend: dat is de gedeelde waarheid.
  // Lokaal toegevoegde blokken worden ingevoegd op hun lokale positie.
  const order = [...remote.map((block) => block.id)];
  for (let index = 0; index < local.length; index++) {
    const block = local[index] as NoteBlock;
    if (remoteById.has(block.id) || baseById.has(block.id)) continue;
    const anchorId = local[index - 1]?.id;
    const anchorPosition = anchorId ? order.indexOf(anchorId) : -1;
    order.splice(anchorPosition + 1, 0, block.id);
  }

  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const localBlock = localById.get(id);
    const remoteBlock = remoteById.get(id);
    const baseBlock = baseById.get(id);

    if (localBlock && remoteBlock) {
      const localChanged = !baseBlock || (localBlock.updatedAt ?? 0) > (baseBlock.updatedAt ?? 0);
      const remoteChanged = !baseBlock || (remoteBlock.updatedAt ?? 0) > (baseBlock.updatedAt ?? 0);
      if (localChanged && !remoteChanged) merged.push(localBlock);
      else if (!localChanged && remoteChanged) merged.push(remoteBlock);
      else if ((localBlock.updatedAt ?? 0) >= (remoteBlock.updatedAt ?? 0)) merged.push(localBlock);
      else merged.push(remoteBlock);
      continue;
    }
    // Aan één kant verwijderd: een verwijdering die de ander niet heeft
    // gewijzigd, wint. Anders behouden we het blok (liever te veel dan te weinig).
    const survivor = localBlock ?? remoteBlock;
    if (!survivor) continue;
    const wasDeletedElsewhere = Boolean(baseBlock);
    const wasEditedHere = !baseBlock || (survivor.updatedAt ?? 0) > (baseBlock.updatedAt ?? 0);
    if (!wasDeletedElsewhere || wasEditedHere) merged.push(survivor);
  }

  return merged;
}
