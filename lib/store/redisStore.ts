/**
 * Upstash Redis GiftStore (production).
 *
 * Keys (all prefixed "gd:"):
 *   gd:config    JSON Config
 *   gd:session   JSON SessionState
 *   gd:turn      integer, global turn counter (= gifts unwrapped)
 *   gd:given     hash prizeId -> number given out
 *   gd:alloc     hash allocId -> "turn|prizeId|at|deviceId"
 *   gd:jackpot   "turn|allocId" of the first jackpot winner
 *   gd:claims    hash allocId -> JSON Claim
 *   gd:codes     hash code -> allocId
 *   gd:rl:*      rate-limit counters (expire automatically)
 */
import { Redis } from "@upstash/redis";
import type { Claim, Config, SessionState } from "../types";
import { ALLOCATE_LUA } from "./allocate.lua";
import { parseRecord, type AllocateInput, type AllocateResult, type GiftStore } from "./types";

const K = {
  config: "gd:config",
  session: "gd:session",
  turn: "gd:turn",
  given: "gd:given",
  alloc: "gd:alloc",
  jackpot: "gd:jackpot",
  claims: "gd:claims",
  codes: "gd:codes",
};

/** Upstash auto-parses JSON; normalize to an object either way. */
function asObj<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

export function createRedisStore(url: string, token: string): GiftStore {
  // automaticDeserialization off: we control JSON ourselves so Lua records stay plain strings.
  const redis = new Redis({ url, token, automaticDeserialization: false });
  const allocScript = redis.createScript<string[]>(ALLOCATE_LUA);

  return {
    name: "redis",
    async getConfig() {
      return asObj<Config>(await redis.get(K.config));
    },
    async setConfig(c) {
      await redis.set(K.config, JSON.stringify(c));
    },
    async getSession() {
      return asObj<SessionState>(await redis.get(K.session));
    },
    async setSession(s) {
      await redis.set(K.session, JSON.stringify(s));
    },

    async allocate(input: AllocateInput): Promise<AllocateResult> {
      const argv: string[] = [
        input.deviceId,
        input.onePerDevice ? "1" : "0",
        input.pickMode,
        input.fallbackId ?? "",
        String(input.rand),
        String(input.now),
        String(input.prizes.length),
      ];
      for (const p of input.prizes) {
        argv.push(p.id, String(p.quantity), String(p.chancePercent), p.guaranteedTurns.join(","), p.isJackpot ? "1" : "0");
      }
      const res = await allocScript.exec([K.turn, K.given, K.alloc, K.jackpot], argv);
      if (!Array.isArray(res) || res[0] === "none") return { kind: "none" };
      const [kind, allocId, record] = res as [string, string, string];
      return { kind: kind === "existing" ? "existing" : "ok", allocation: parseRecord(allocId, record) };
    },
    async getAllocation(allocId) {
      const rec = await redis.hget<string>(K.alloc, allocId);
      return rec ? parseRecord(allocId, String(rec)) : null;
    },
    async getTurnCount() {
      return Number((await redis.get(K.turn)) ?? 0);
    },
    async getGivenCounts() {
      const h = (await redis.hgetall<Record<string, string>>(K.given)) ?? {};
      return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Number(v)]));
    },
    async getJackpot() {
      const v = await redis.get<string>(K.jackpot);
      if (!v) return null;
      const [turn, allocId] = String(v).split("|");
      return { turn: Number(turn), allocId };
    },

    async reserveCode(code, allocId) {
      return (await redis.hsetnx(K.codes, code, allocId)) === 1;
    },
    async createClaim(claim) {
      return (await redis.hsetnx(K.claims, claim.allocId, JSON.stringify(claim))) === 1;
    },
    async updateClaim(claim) {
      await redis.hset(K.claims, { [claim.allocId]: JSON.stringify(claim) });
    },
    async getClaim(allocId) {
      return asObj<Claim>(await redis.hget(K.claims, allocId));
    },
    async getClaimByCode(code) {
      const allocId = await redis.hget<string>(K.codes, code);
      return allocId ? asObj<Claim>(await redis.hget(K.claims, String(allocId))) : null;
    },
    async listClaims() {
      const h = (await redis.hgetall<Record<string, string>>(K.claims)) ?? {};
      return Object.values(h)
        .map((v) => asObj<Claim>(v))
        .filter((c): c is Claim => !!c)
        .sort((a, b) => a.turn - b.turn);
    },
    async countClaims() {
      return Number(await redis.hlen(K.claims));
    },

    async rateLimit(key, limit, windowSeconds) {
      const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
      const k = `gd:rl:${key}:${bucket}`;
      const p = redis.pipeline();
      p.incr(k);
      p.expire(k, windowSeconds + 5);
      const [count] = (await p.exec()) as [number, number];
      return Number(count) <= limit;
    },
    async resetEventData() {
      await redis.del(K.turn, K.given, K.alloc, K.jackpot, K.claims, K.codes);
    },
  };
}
