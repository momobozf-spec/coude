import { describe, expect, it, vi } from 'vitest';
import { ImportService, MAX_FAILURE_RATIO } from './import.service';

/**
 * De deactivatiegrens: een bron die deels onleesbaar was, mag geen geldige
 * prijzen wegvagen. Alleen de beslissing wordt getest; de database is nep.
 */
function service() {
  const storeProduct = { updateMany: vi.fn(async () => ({ count: 3 })) };
  const productOffer = { updateMany: vi.fn(async () => ({ count: 5 })) };
  const prisma = { storeProduct, productOffer };
  const config = { adapterTimeoutMs: 1000 };
  const instance = new ImportService(prisma as never, config as never, []);
  const run = (products: number, offers: number, errors: number, seenOffers = Math.max(0, offers - errors)) =>
    (instance as unknown as { deactivateUnseen: (...args: unknown[]) => Promise<{ skipped: boolean; reason: string | null }> }).deactivateUnseen(
      { id: 'chain-1' },
      { products: Array.from({ length: products }, (_, i) => ({ externalId: `p${i}` })), offers: Array.from({ length: offers }, (_, i) => ({ sourceReference: `o${i}` })) },
      new Set(Array.from({ length: products }, (_, i) => `p${i}`)),
      new Set(Array.from({ length: seenOffers }, (_, i) => `o${i}`)),
      Array.from({ length: errors }, (_, i) => `fout ${i}`),
      { offersDeactivated: 0 },
    );
  return { run, storeProduct, productOffer };
}

describe('ImportService.deactivateUnseen', () => {
  it('deactiveert wat de bron niet meer noemt bij een gezonde import', async () => {
    const { run, productOffer, storeProduct } = service();
    const result = await run(50, 50, 0);
    expect(result).toEqual({ skipped: false, reason: null });
    expect(storeProduct.updateMany).toHaveBeenCalledTimes(1);
    expect(productOffer.updateMany).toHaveBeenCalledTimes(1);
  });

  it('tolereert fouten tot de grens', async () => {
    const { run, productOffer } = service();
    const errors = Math.floor(100 * MAX_FAILURE_RATIO); // precies op de grens: 20 van 100
    const result = await run(50, 50, errors);
    expect(result.skipped).toBe(false);
    expect(productOffer.updateMany).toHaveBeenCalledTimes(1);
  });

  it('slaat deactivering over boven de grens en raakt de database niet aan', async () => {
    const { run, productOffer, storeProduct } = service();
    const result = await run(50, 50, 21);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/21 % van de regels faalde/);
    expect(storeProduct.updateMany).not.toHaveBeenCalled();
    expect(productOffer.updateMany).not.toHaveBeenCalled();
  });

  it('slaat deactivering over bij een lege of onbruikbare bron', async () => {
    const { run, productOffer } = service();
    expect((await run(0, 0, 0)).skipped).toBe(true);
    expect((await run(10, 10, 0, 0)).skipped).toBe(true);
    expect(productOffer.updateMany).not.toHaveBeenCalled();
  });
});
