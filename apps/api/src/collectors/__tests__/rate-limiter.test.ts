import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  it('resolves immediately when tokens are available', async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('allows up to maxRequestsPerSecond immediate calls without delay', async () => {
    const limiter = new RateLimiter(5);
    const promises = Array.from({ length: 5 }, () => limiter.acquire());
    const start = Date.now();
    await Promise.all(promises);
    // All 5 should complete quickly (tokens available)
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('throttles when tokens are exhausted', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2);

    // Drain the 2 available tokens
    await limiter.acquire();
    await limiter.acquire();

    // Third acquire should schedule a setTimeout
    let resolved = false;
    const p = limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    // Advance time to allow token refill (at 2 req/s, 1 token refills in 500ms)
    await vi.advanceTimersByTimeAsync(600);
    await p;

    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});
