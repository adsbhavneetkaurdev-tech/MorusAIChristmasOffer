import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/defaults";
import { choosePrize, enginePrizes, simulate } from "@/lib/engine";
import { createMemoryStore } from "@/lib/store/memoryStore";
import { claimGift, loadSession, unwrap } from "@/lib/service";
import type { Config } from "@/lib/types";

async function liveStore(config: Config = defaultConfig()) {
  const store = createMemoryStore();
  await store.setConfig(config);
  const s = await loadSession(store);
  await store.setSession({ ...s, status: "live", endsAt: Date.now() + 600_000, startedAt: Date.now() });
  return store;
}

const dev = (i: number) => `device-${String(i).padStart(6, "0")}`;

describe("prize engine", () => {
  it("gives the jackpot exactly at turn 7 (and only there)", async () => {
    for (let run = 0; run < 25; run++) {
      const store = await liveStore();
      const results = [];
      for (let i = 1; i <= 120; i++) results.push(await unwrap(dev(i), store));
      const jackpots = results.filter((r) => r.ok && r.prize.isJackpot);
      expect(jackpots).toHaveLength(1);
      expect(jackpots[0].ok && jackpots[0].turn).toBe(7);
      expect((await store.getJackpot())?.turn).toBe(7);
    }
  });

  it("never gives a reserved jackpot early, even if it has a chance", () => {
    const c = defaultConfig();
    c.prizes[0].chancePercent = 90;
    for (let turn = 1; turn < 7; turn++) {
      for (let k = 0; k < 50; k++) {
        const id = choosePrize({ turn, prizes: enginePrizes(c, {}), pickMode: c.pickMode, fallbackId: "1m", rand: Math.random() });
        expect(id).not.toBe("jackpot-1y");
      }
    }
  });

  it("never oversells under 200 concurrent unwraps", async () => {
    const c = defaultConfig();
    c.fallbackPrizeId = "none"; // 101 prizes total, 200 guests
    const store = await liveStore(c);
    const results = await Promise.all(Array.from({ length: 200 }, (_, i) => unwrap(dev(i), store)));
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(101);
    expect(results.filter((r) => !r.ok && r.reason === "all_claimed")).toHaveLength(99);
    const given = await store.getGivenCounts();
    for (const p of c.prizes) expect(given[p.id] ?? 0).toBe(p.quantity);
    const turns = ok.map((r) => (r.ok ? r.turn : 0)).sort((a, b) => a - b);
    expect(turns).toEqual(Array.from({ length: 101 }, (_, i) => i + 1)); // unique turn numbers
    expect(ok.filter((r) => r.ok && r.prize.isJackpot)).toHaveLength(1);
  });

  it("uses the fallback (unlimited) when everything runs out", async () => {
    const c = defaultConfig();
    c.prizes = c.prizes.map((p) => ({ ...p, quantity: p.isJackpot ? 1 : 2 }));
    const store = await liveStore(c);
    const results = [];
    for (let i = 0; i < 30; i++) results.push(await unwrap(dev(i), store));
    expect(results.every((r) => r.ok)).toBe(true);
    const given = await store.getGivenCounts();
    expect(given["6m"]).toBe(2);
    expect(given["3m"]).toBe(2);
    expect(given["1m"]).toBe(30 - 1 - 2 - 2);
  });

  it('returns "all claimed" when fallback is none and stock is gone', async () => {
    const c = defaultConfig();
    c.fallbackPrizeId = "none";
    c.prizes = c.prizes.map((p) => ({ ...p, quantity: p.isJackpot ? 0 : 1, guaranteedTurns: [] }));
    const store = await liveStore(c);
    for (let i = 0; i < 3; i++) expect((await unwrap(dev(i), store)).ok).toBe(true);
    const r = await unwrap(dev(99), store);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("all_claimed");
    expect(await store.getTurnCount()).toBe(3);
  });

  it("gives the same device the same prize, no re-rolls", async () => {
    const store = await liveStore();
    const first = await unwrap(dev(1), store);
    const again = await Promise.all(Array.from({ length: 20 }, () => unwrap(dev(1), store)));
    for (const r of again) {
      expect(r.ok && first.ok && r.prize.id === first.prize.id && r.turn === first.turn).toBe(true);
      expect(r.ok && r.existing).toBe(true);
    }
    expect(await store.getTurnCount()).toBe(1);
    // ...even after the drop has closed
    const s = await loadSession(store);
    await store.setSession({ ...s, status: "closed" });
    const late = await unwrap(dev(1), store);
    expect(late.ok && first.ok && late.prize.id === first.prize.id).toBe(true);
    expect((await unwrap(dev(2), store)).ok).toBe(false);
  });

  it("rejects unwraps unless live", async () => {
    const store = createMemoryStore();
    const r = await unwrap(dev(1), store);
    expect(!r.ok && r.reason).toBe("not_live");
  });

  it("skips 0% and sold-out prizes and re-normalizes", () => {
    const c = defaultConfig();
    const given = { "6m": 20 }; // sold out
    for (let k = 0; k < 200; k++) {
      const id = choosePrize({ turn: 50, prizes: enginePrizes(c, given), pickMode: "fixed_chance", fallbackId: "1m", rand: Math.random() });
      expect(["3m", "1m"]).toContain(id);
    }
    // rand near 1 still lands on the last available prize
    expect(choosePrize({ turn: 50, prizes: enginePrizes(c, given), pickMode: "fixed_chance", fallbackId: null, rand: 0.999999 })).toBe("1m");
  });

  it("weighted_by_remaining follows stock", () => {
    const c = defaultConfig();
    const prizes = enginePrizes(c, { "6m": 19, "3m": 30 }); // 1 x 6m, 0 x 3m, 50 x 1m left
    const counts: Record<string, number> = {};
    for (let k = 0; k < 5100; k++) {
      const id = choosePrize({ turn: 100, prizes, pickMode: "weighted_by_remaining", fallbackId: null, rand: Math.random() })!;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts["3m"]).toBeUndefined();
    expect(counts["1m"]).toBeGreaterThan(counts["6m"] * 10);
  });

  it("issues one claim per device with unique codes", async () => {
    const store = await liveStore();
    const codes = new Set<string>();
    for (let i = 0; i < 60; i++) {
      await unwrap(dev(i), store);
      const input = { deviceId: dev(i), name: "Pat Realtor", email: `pat${i}@example.com`, company: "Brokerage", phone: "(780) 555-0123", consent: true };
      const [a, b] = await Promise.all([claimGift(input, store), claimGift(input, store)]);
      expect(a.ok && b.ok && a.claim.code === b.claim.code).toBe(true);
      if (a.ok) {
        expect(a.claim.code).toMatch(/^MORUS-(1Y|6M|3M|1M)-[A-HJ-NP-Z2-9]{4}$/);
        codes.add(a.claim.code);
      }
    }
    expect(codes.size).toBe(60);
    expect(await store.countClaims()).toBe(60);
    const noConsent = await claimGift({ deviceId: dev(1), name: "A B", email: "a@b.co", company: "X Co", phone: "7805550123", consent: false }, store);
    expect(!noConsent.ok && noConsent.fields?.consent).toBeTruthy();
  });

  it("simulator gives sensible averages", () => {
    const r = simulate(defaultConfig(), 120, 300);
    const total = r.average.reduce((s, a) => s + a.average, 0);
    expect(total + r.averageNothing).toBeCloseTo(120, 5);
    expect(r.jackpotWonInPercentOfRuns).toBe(100);
    expect(r.averageJackpotTurn).toBe(7);
  });
});
