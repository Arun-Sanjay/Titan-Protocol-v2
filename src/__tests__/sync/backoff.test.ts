import { backoffMs, isoPlus, MAX_ATTEMPTS } from "../../sync/backoff";

describe("backoffMs", () => {
  // Temporarily pin Math.random so jitter is predictable.
  const originalRandom = Math.random;
  beforeAll(() => {
    Math.random = () => 0.5; // midpoint: jitter multiplier = 1.0
  });
  afterAll(() => {
    Math.random = originalRandom;
  });

  test("grows geometrically up to the cap", () => {
    // With random=0.5, jitter factor = 1.0 (range is 0.8..1.2)
    expect(backoffMs(0)).toBe(5_000);
    expect(backoffMs(1)).toBe(15_000);
    expect(backoffMs(2)).toBe(45_000);
    expect(backoffMs(3)).toBe(135_000);
  });

  test("caps at 1 hour for large attempt counts", () => {
    expect(backoffMs(100)).toBe(60 * 60 * 1000);
    expect(backoffMs(MAX_ATTEMPTS + 10)).toBe(60 * 60 * 1000);
  });

  test("clamps negative attempts to zero", () => {
    expect(backoffMs(-5)).toBe(5_000);
  });

  test("jitter stays within ±20%", () => {
    Math.random = () => 0; // multiplier = 0.8
    const low = backoffMs(0);
    Math.random = () => 0.999999; // multiplier ≈ 1.2
    const high = backoffMs(0);
    expect(low).toBe(4_000);
    expect(high).toBe(6_000); // 5000 * 1.2 - 1 rounding
    Math.random = () => 0.5;
  });
});

describe("isoPlus", () => {
  test("returns an ISO string `ms` from now", () => {
    const now = Date.now();
    const iso = isoPlus(60_000);
    const parsed = new Date(iso).getTime();
    // within a 500ms tolerance of now+60s
    expect(parsed).toBeGreaterThanOrEqual(now + 60_000 - 500);
    expect(parsed).toBeLessThanOrEqual(now + 60_000 + 500);
  });
});
