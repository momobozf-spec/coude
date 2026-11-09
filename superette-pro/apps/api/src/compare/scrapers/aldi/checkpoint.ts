import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { z } from 'zod';
import { PRODUCT_URL } from './parse';

const entrySchema = z.object({
  url: z.string().regex(PRODUCT_URL),
  input: z.object({ url: z.string().regex(PRODUCT_URL), jsonLd: z.array(z.string()), salesUnit: z.string().nullable() }).nullable(),
});
export const checkpointSchema = z.object({
  version: z.literal(1),
  signature: z.string(),
  startedAt: z.string().datetime(),
  status: z.enum(['RUNNING', 'INTERRUPTED', 'BLOCKED', 'COMPLETE']),
  inSitemap: z.number().int().nonnegative(),
  urls: z.array(z.string().regex(PRODUCT_URL)).max(2000),
  entries: z.array(entrySchema).max(2000),
}).superRefine((value, context) => {
  if (new Set(value.urls).size !== value.urls.length || value.entries.length > value.urls.length) context.addIssue({ code: 'custom', message: 'Ongeldige checkpointvolgorde.' });
  value.entries.forEach((entry, index) => {
    if (entry.url !== value.urls[index] || (entry.input && entry.input.url !== entry.url)) context.addIssue({ code: 'custom', message: 'Checkpoint verwijst naar een andere productpagina.' });
  });
});
export type AldiCheckpoint = z.infer<typeof checkpointSchema>;
export function readCheckpoint(file: string, signature: string, now = Date.now()): AldiCheckpoint {
  const main = existsSync(file) ? checkpointSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : null;
  let checkpoint = main;
  if (existsSync(`${file}.tmp`)) {
    const candidate = checkpointSchema.safeParse(JSON.parse(readFileSync(`${file}.tmp`, 'utf8')));
    if (candidate.success) {
      const newer = candidate.data;
      if (!main || (newer.signature === main.signature && newer.startedAt === main.startedAt && JSON.stringify(newer.urls) === JSON.stringify(main.urls) && newer.entries.length >= main.entries.length && JSON.stringify(newer.entries.slice(0, main.entries.length)) === JSON.stringify(main.entries))) checkpoint = newer;
      else throw new Error('Tijdelijk checkpoint heeft een afwijkende oorsprong; niet hervat.');
    }
  }
  if (!checkpoint) throw new Error('Geen geldig checkpoint beschikbaar.');
  if (checkpoint.signature !== signature) throw new Error('Configuratie is veranderd; checkpoint niet hervat.');
  if (checkpoint.status === 'BLOCKED') throw new Error('Geblokkeerde run wordt niet automatisch hervat.');
  const age = now - Date.parse(checkpoint.startedAt);
  if (age < -60_000 || age > 48 * 3600_000) throw new Error('Checkpoint ouder dan 48 uur of uit de toekomst; niet hervat.');
  return checkpoint;
}
export function writeCheckpoint(file: string, checkpoint: AldiCheckpoint): void {
  checkpointSchema.parse(checkpoint);
  writeFileSync(`${file}.tmp`, JSON.stringify(checkpoint), 'utf8');
  renameSync(`${file}.tmp`, file);
}
/** Browser sluiten, ook als het laatste herstelpunt niet kan worden geschreven. */
export async function finishRun(save: () => void, close: () => Promise<void>): Promise<void> {
  try { save(); } finally { await close(); }
}
