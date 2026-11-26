/**
 * In-memory GiftStore for local development and tests.
 * NOT for production: Vercel runs many server instances that don't share memory.
 * allocate() is atomic because it runs synchronously (no await) inside one Node process.
 */
import { choosePrize } from "../engine";
import type { Allocation, Claim, Config, SessionState } from "../types";
import type { AllocateInput, AllocateResult, GiftStore } from "./types";

export function createMemoryStore(): GiftStore {
  let config: Config | null = null;
  let session: SessionState | null = null;
  let turn = 0;
  let given: Record<string, number> = {};
  let allocs = new Map<string, Allocation>();
  let jackpot: { turn: number; allocId: string } | null = null;
  let claims = new Map<string, Claim>();
  let codes = new Map<string, string>();
  const rl = new Map<string, { count: number; until: number }>();

  const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

  return {
    name: "memory",
    async getConfig() {
      return clone(config);
    },
    async setConfig(c) {
      config = clone(c);
    },
    async getSession() {
      return clone(session);
    },
    async setSession(s) {
      session = clone(s);
    },

    async allocate(input: AllocateInput): Promise<AllocateResult> {
      // Everything below is synchronous: it cannot interleave with another call.
      if (input.onePerDevice) {
        const existing = allocs.get(input.deviceId);
        if (existing) return { kind: "existing", allocation: { ...existing } };
      }
      const nextTurn = turn + 1;
      const prizes = input.prizes.map((p) => ({ ...p, given: given[p.id] ?? 0 }));
      const id = choosePrize({
        turn: nextTurn,
        prizes,
        pickMode: input.pickMode,
        fallbackId: input.fallbackId,
        rand: input.rand,
      });
      if (!id) return { kind: "none" };
      turn = nextTurn;
      given[id] = (given[id] ?? 0) + 1;
      const allocId = input.onePerDevice ? input.deviceId : `${input.deviceId}#${nextTurn}`;
      const allocation: Allocation = { allocId, deviceId: input.deviceId, turn: nextTurn, prizeId: id, at: input.now };
      allocs.set(allocId, allocation);
      if (prizes.find((p) => p.id === id)?.isJackpot && !jackpot) jackpot = { turn: nextTurn, allocId };
      return { kind: "ok", allocation: { ...allocation } };
    },
    async getAllocation(allocId) {
      const a = allocs.get(allocId);
      return a ? { ...a } : null;
    },
    async getTurnCount() {
      return turn;
    },
    async getGivenCounts() {
      return { ...given };
    },
    async getJackpot() {
      return jackpot ? { ...jackpot } : null;
    },

    async reserveCode(code, allocId) {
      if (codes.has(code)) return false;
      codes.set(code, allocId);
      return true;
    },
    async createClaim(claim) {
      if (claims.has(claim.allocId)) return false;
      claims.set(claim.allocId, clone(claim));
      return true;
    },
    async updateClaim(claim) {
      claims.set(claim.allocId, clone(claim));
    },
    async getClaim(allocId) {
      return clone(claims.get(allocId) ?? null);
    },
    async getClaimByCode(code) {
      const allocId = codes.get(code);
      return allocId ? clone(claims.get(allocId) ?? null) : null;
    },
    async listClaims() {
      return [...claims.values()].map(clone).sort((a, b) => a.turn - b.turn);
    },
    async countClaims() {
      return claims.size;
    },

    async rateLimit(key, limit, windowSeconds) {
      const now = Date.now();
      const entry = rl.get(key);
      if (!entry || entry.until < now) {
        rl.set(key, { count: 1, until: now + windowSeconds * 1000 });
        return true;
      }
      entry.count++;
      return entry.count <= limit;
    },
    async resetEventData() {
      turn = 0;
      given = {};
      allocs = new Map();
      jackpot = null;
      claims = new Map();
      codes = new Map();
    },
  };
}
