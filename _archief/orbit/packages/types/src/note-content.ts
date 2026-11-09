import type { AttachmentId, ItemId } from './ids';

/**
 * Notitie-content is een platte array van blokken, geen HTML.
 *
 * Waarom: elk blok heeft een stabiel id, waardoor de sync-engine per blok kan
 * mergen in plaats van het hele document te overschrijven. Twee devices die aan
 * verschillende alinea's werken raken elkaar dan niet kwijt. HTML of een string
 * zou hier alleen last-write-wins toelaten.
 */

export const BlockType = {
  Paragraph: 'PARAGRAPH',
  Heading1: 'HEADING_1',
  Heading2: 'HEADING_2',
  Heading3: 'HEADING_3',
  BulletItem: 'BULLET_ITEM',
  NumberedItem: 'NUMBERED_ITEM',
  ChecklistItem: 'CHECKLIST_ITEM',
  Quote: 'QUOTE',
  Code: 'CODE',
  Divider: 'DIVIDER',
  Image: 'IMAGE',
  File: 'FILE',
  Table: 'TABLE',
  ItemLink: 'ITEM_LINK',
} as const;
export type BlockType = (typeof BlockType)[keyof typeof BlockType];

export const TextMark = {
  Bold: 'BOLD',
  Italic: 'ITALIC',
  Underline: 'UNDERLINE',
  Strike: 'STRIKE',
  Code: 'CODE',
  Highlight: 'HIGHLIGHT',
} as const;
export type TextMark = (typeof TextMark)[keyof typeof TextMark];

/** Een aaneengesloten stuk tekst met dezelfde opmaak. */
export interface RichSpan {
  text: string;
  marks?: TextMark[];
  /** Externe link. */
  href?: string;
  /** Interne link naar een ander item; rendert als chip en maakt een backlink. */
  itemId?: ItemId;
}

export interface TableCell {
  spans: RichSpan[];
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface NoteBlock {
  /** Stabiel over edits heen; de sync-engine mergt hierop. */
  id: string;
  type: BlockType;
  spans?: RichSpan[];
  /** CHECKLIST_ITEM */
  checked?: boolean;
  /** Inspringniveau voor lijsten, 0-5. */
  indent?: number;
  /** CODE */
  language?: string;
  /** IMAGE / FILE */
  attachmentId?: AttachmentId;
  /** IMAGE */
  width?: number;
  height?: number;
  /** ITEM_LINK */
  itemId?: ItemId;
  /** TABLE */
  rows?: TableRow[];
  headerRow?: boolean;
  /** Wanneer dit blok voor het laatst is aangeraakt; gebruikt bij blok-merge. */
  updatedAt?: number;
}

export type NoteContent = NoteBlock[];

export const EMPTY_NOTE_CONTENT: NoteContent = [];
