import { ConflictException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPushService } from './feed-push.service';

type Run = { keys?: readonly string[] };

function makeService(runSync: (options: Run) => Promise<{ failedAdapters: string[] }>) {
  const sync = { runSync: vi.fn(runSync) };
  // Alleen de wachtrij wordt getest; prisma/config/adapters komen niet aan bod.
  const service = new FeedPushService({} as never, {} as never, sync as never, [] as never);
  const start = (key: string) => (service as unknown as { startSync(k: string, r: string): void }).startSync(key, `req-${key}`);
  return { service, sync, start };
}

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('feed-push wachtrij', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('bundelt pushes die binnenkomen terwijl een sync loopt, en draait ze daarna in één run', async () => {
    let release!: () => void;
    const first = new Promise<{ failedAdapters: string[] }>((resolve) => { release = () => resolve({ failedAdapters: [] }); });
    const { sync, start } = makeService(() => (sync.runSync.mock.calls.length === 1 ? first : Promise.resolve({ failedAdapters: [] })));
    start('aldi');
    start('lidl');
    start('jumbo');
    expect(sync.runSync).toHaveBeenCalledTimes(1);
    expect(sync.runSync.mock.calls[0]![0].keys).toEqual(['aldi']);
    release();
    await flush();
    await vi.runOnlyPendingTimersAsync();
    expect(sync.runSync).toHaveBeenCalledTimes(2);
    expect([...sync.runSync.mock.calls[1]![0].keys!].sort()).toEqual(['jumbo', 'lidl']);
  });

  it('probeert opnieuw als een ander proces de lease houdt', async () => {
    let calls = 0;
    const { sync, start } = makeService(() => (++calls <= 2 ? Promise.reject(new ConflictException('bezig')) : Promise.resolve({ failedAdapters: [] })));
    start('aldi');
    await flush();
    expect(sync.runSync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FeedPushService.RETRY_DELAY_MS);
    await flush();
    expect(sync.runSync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(FeedPushService.RETRY_DELAY_MS);
    await flush();
    expect(sync.runSync).toHaveBeenCalledTimes(3);
    expect(sync.runSync.mock.calls[2]![0].keys).toEqual(['aldi']);
  });

  it('geeft op na het maximum aantal pogingen (de dagelijkse sync neemt het over)', async () => {
    const { sync, start } = makeService(() => Promise.reject(new ConflictException('bezig')));
    start('aldi');
    for (let i = 0; i <= FeedPushService.MAX_RETRY_ATTEMPTS + 2; i++) {
      await flush();
      await vi.advanceTimersByTimeAsync(FeedPushService.RETRY_DELAY_MS);
    }
    expect(sync.runSync).toHaveBeenCalledTimes(FeedPushService.MAX_RETRY_ATTEMPTS + 1);
  });

  it('stopt de wachtrij bij een echte fout (geen eindeloze herhaling)', async () => {
    const { sync, start } = makeService(() => Promise.reject(new Error('database weg')));
    start('aldi');
    await flush();
    await vi.advanceTimersByTimeAsync(FeedPushService.RETRY_DELAY_MS * 3);
    expect(sync.runSync).toHaveBeenCalledTimes(1);
  });
});
