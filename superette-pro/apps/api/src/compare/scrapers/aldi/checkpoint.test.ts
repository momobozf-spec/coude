import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkpointSchema, readCheckpoint, writeCheckpoint, finishRun, type AldiCheckpoint } from './checkpoint';
const evidence = JSON.parse(readFileSync(join(__dirname, 'fixtures/diagnose-2026-10-08.json'), 'utf8'));
const input = { url: evidence[0].url, jsonLd: evidence[0].jsonLd, salesUnit: evidence[0].salesUnit };
function fixture(): AldiCheckpoint { return { version: 1, signature: 'testconfig', startedAt: '2026-10-08T11:32:30.239Z', status: 'INTERRUPTED', inSitemap: 2830, urls: [input.url], entries: [{ url: input.url, input }] }; }
const now = Date.parse(fixture().startedAt) + 60_000;
function withFile(action: (file: string) => void) { const dir = mkdtempSync(join(tmpdir(), 'superette-checkpoint-')); try { const file = join(dir, 'checkpoint.json'); writeCheckpoint(file, fixture()); action(file); } finally { rmSync(dir, { recursive: true, force: true }); } }
describe('ALDI herstelpunten', () => {
  it('herstelt een verder gevorderd tijdelijk bestand met dezelfde bronvolgorde', () => withFile((file) => {
    const value = fixture(); const second = evidence[1];
    value.urls.push(second.url); writeCheckpoint(file, value);
    value.entries.push({ url: second.url, input: { url: second.url, jsonLd: second.jsonLd, salesUnit: second.salesUnit } });
    writeFileSync(file + '.tmp', JSON.stringify(value));
    expect(readCheckpoint(file, 'testconfig', now).entries).toHaveLength(2);
  }));
  it('sluit de browser ook bij een schrijffout', async () => {
    let closed = false;
    await expect(finishRun(() => { throw new Error('EBUSY'); }, async () => { closed = true; })).rejects.toThrow('EBUSY');
    expect(closed).toBe(true);
  });
  it('bewaart de echte brongegevens bij onderbreking en leest ze ongewijzigd terug', () => withFile((file) => expect(readCheckpoint(file, 'testconfig', now)).toEqual(fixture())));
  it('weigert gewijzigde configuratie', () => withFile((file) => expect(() => readCheckpoint(file, 'anders', now)).toThrow(/Configuratie/)));
  it('weigert hervatten na botblokkade', () => withFile((file) => { const value = fixture(); value.status = 'BLOCKED'; writeCheckpoint(file, value); expect(() => readCheckpoint(file, 'testconfig', now)).toThrow(/Geblokkeerde/); }));
  it('weigert gegevens ouder dan 48 uur', () => withFile((file) => expect(() => readCheckpoint(file, 'testconfig', now + 49 * 3600_000)).toThrow(/48 uur/)));
  it('weigert een verwisselde productpagina', () => { const value = fixture(); value.entries[0]!.url = evidence[1].url; expect(checkpointSchema.safeParse(value).success).toBe(false); });
  it('weigert dubbele geplande URLs', () => { const value = fixture(); value.urls.push(input.url); expect(checkpointSchema.safeParse(value).success).toBe(false); });
  it('laat een bestaand checkpoint geldig na een atomische update', () => withFile((file) => { const value = fixture(); value.status = 'COMPLETE'; writeCheckpoint(file, value); expect(readCheckpoint(file, 'testconfig', now).status).toBe('COMPLETE'); }));
});
