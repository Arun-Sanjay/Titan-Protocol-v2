import { describe, it, expect } from "vitest";

import {
  deriveEntitlement,
  type Subscription,
} from "../services/subscription";

const DAY = 86_400_000;
const mk = (p: Partial<Subscription>): Subscription =>
  p as unknown as Subscription;

describe("deriveEntitlement", () => {
  it("treats a missing subscription as free", () => {
    const e = deriveEntitlement(null);
    expect(e.plan).toBe("free");
    expect(e.isPro).toBe(false);
  });

  it("grants Pro for an active subscription with no expiry", () => {
    const e = deriveEntitlement(mk({ status: "active" }));
    expect(e.isPro).toBe(true);
    expect(e.plan).toBe("pro");
  });

  it("grants Pro while the entitlement is unexpired", () => {
    const future = new Date(Date.now() + 30 * DAY).toISOString();
    expect(deriveEntitlement(mk({ status: "active", expires_at: future })).isPro).toBe(
      true,
    );
  });

  it("drops to free once the entitlement has expired", () => {
    const past = new Date(Date.now() - DAY).toISOString();
    const e = deriveEntitlement(mk({ status: "active", expires_at: past }));
    expect(e.isPro).toBe(false);
    expect(e.plan).toBe("free");
  });

  it("honours trial + grace statuses as Pro", () => {
    expect(deriveEntitlement(mk({ status: "trial" })).isPro).toBe(true);
    expect(deriveEntitlement(mk({ status: "grace" })).isPro).toBe(true);
  });

  it("treats cancelled / expired statuses as free", () => {
    expect(deriveEntitlement(mk({ status: "expired" })).isPro).toBe(false);
    expect(deriveEntitlement(mk({ status: "cancelled" })).isPro).toBe(false);
  });

  it("passes through willRenew + store for display", () => {
    const e = deriveEntitlement(
      mk({ status: "active", will_renew: true, store: "stripe" }),
    );
    expect(e.willRenew).toBe(true);
    expect(e.store).toBe("stripe");
  });
});

describe("deriveEntitlement — 1-day trial", () => {
  const NOW = Date.parse("2026-06-13T12:00:00.000Z");

  it("grants Pro during the 24h trial window", () => {
    const startedAt = new Date(NOW - 60 * 60 * 1000).toISOString(); // 1h ago
    const e = deriveEntitlement(null, startedAt, NOW);
    expect(e.isPro).toBe(true);
    expect(e.source).toBe("trial");
    expect(e.trialActive).toBe(true);
  });

  it("drops to free once the trial has expired", () => {
    const startedAt = new Date(NOW - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const e = deriveEntitlement(null, startedAt, NOW);
    expect(e.isPro).toBe(false);
    expect(e.source).toBe(null);
    expect(e.trialActive).toBe(false);
  });

  it("a never-started trial is free", () => {
    expect(deriveEntitlement(null, null, NOW).isPro).toBe(false);
  });

  it("prefers an active subscription as the source over a trial", () => {
    const startedAt = new Date(NOW - 60 * 60 * 1000).toISOString();
    const e = deriveEntitlement(mk({ status: "active" }), startedAt, NOW);
    expect(e.isPro).toBe(true);
    expect(e.source).toBe("subscription");
  });
});
