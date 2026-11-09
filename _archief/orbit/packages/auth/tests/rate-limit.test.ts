import { describe, expect, it } from 'vitest';
import { MemoryRateLimitStore, RATE_LIMITS, RateLimiter, rateLimitKey } from '../src/rate-limit';

describe('token bucket', () => {
  it('laat verzoeken door tot de bucket leeg is', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { capacity: 3, refillPerSecond: 1 };
    const now = 1_000_000;

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await limiter.consume('test', rule, 1, now);
      expect(result.allowed).toBe(true);
    }
    const blocked = await limiter.consume('test', rule, 1, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
  });

  it('vult geleidelijk bij', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { capacity: 2, refillPerSecond: 1 };
    const start = 2_000_000;

    await limiter.consume('bijvullen', rule, 2, start);
    expect((await limiter.consume('bijvullen', rule, 1, start)).allowed).toBe(false);
    expect((await limiter.consume('bijvullen', rule, 1, start + 1000)).allowed).toBe(true);
  });

  it('loopt niet over de capaciteit heen', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { capacity: 5, refillPerSecond: 1 };
    const start = 3_000_000;

    await limiter.consume('plafond', rule, 5, start);
    // Een uur later mag de burst hooguit weer de volle capaciteit zijn.
    const afterLongPause = start + 3_600_000;
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await limiter.consume('plafond', rule, 1, afterLongPause)).allowed).toBe(true);
    }
    expect((await limiter.consume('plafond', rule, 1, afterLongPause)).allowed).toBe(false);
  });

  it('houdt sleutels gescheiden', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const rule = { capacity: 1, refillPerSecond: 0.1 };
    const now = 4_000_000;

    expect((await limiter.consume('a', rule, 1, now)).allowed).toBe(true);
    expect((await limiter.consume('b', rule, 1, now)).allowed).toBe(true);
    expect((await limiter.consume('a', rule, 1, now)).allowed).toBe(false);
  });

  it('rekent een sync-batch als meerdere tokens', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore());
    const now = 5_000_000;
    const result = await limiter.consume('sync', RATE_LIMITS.syncPush, 50, now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(150);
  });

  it('sleutelt op gebruiker als die bekend is, anders op ip', () => {
    expect(rateLimitKey('login', { ip: '1.2.3.4' })).toBe('login:ip:1.2.3.4');
    expect(rateLimitKey('write', { userId: 'abc', ip: '1.2.3.4' })).toBe('write:u:abc');
  });
});
