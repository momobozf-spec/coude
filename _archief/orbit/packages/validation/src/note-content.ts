import type { NoteBlock, NoteContent, RichSpan } from '@orbit/types';
import { z } from 'zod';
import { blockTypeSchema, textMarkSchema } from './enums';
import { LIMITS, ulidSchema, urlSchema } from './primitives';

export const richSpanSchema: z.ZodType<RichSpan> = z.object({
  text: z.string().max(50_000),
  marks: z.array(textMarkSchema).max(6).optional(),
  href: urlSchema.optional(),
  itemId: ulidSchema.optional(),
});

const tableRowSchema = z.object({
  id: z.string().min(1).max(64),
  cells: z
    .array(z.object({ spans: z.array(richSpanSchema).max(200) }))
    .max(20),
});

export const noteBlockSchema: z.ZodType<NoteBlock> = z.object({
  id: z.string().min(1).max(64),
  type: blockTypeSchema,
  spans: z.array(richSpanSchema).max(500).optional(),
  checked: z.boolean().optional(),
  indent: z.number().int().min(0).max(5).optional(),
  language: z.string().max(32).optional(),
  attachmentId: ulidSchema.optional(),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional(),
  itemId: ulidSchema.optional(),
  rows: z.array(tableRowSchema).max(200).optional(),
  headerRow: z.boolean().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
});

export const noteContentSchema: z.ZodType<NoteContent> = z
  .array(noteBlockSchema)
  .max(LIMITS.blocksMax, `Een notitie mag maximaal ${LIMITS.blocksMax} blokken bevatten`);
