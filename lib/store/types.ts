/**
 * GiftStore: the ONLY place the app talks to a database.
 *
 * Two implementations ship with the app:
 *   - redisStore  (production; Upstash Redis via KV_REST_API_URL / KV_REST_API_TOKEN)
 *   - memoryStore (local development only; data lives in one Node process)
 *
 * To use another database, implement this interface (see README "For the developer")
 * and return it from getStore() in lib/store/index.ts. The one hard requirement is
 * that allocate() is ATOMIC: two concurrent calls must never both see the same
 * stock. In SQL that means a transaction with SELECT ... FOR UPDATE (or a
 * serializable transaction) around the read-decide-write sequence.
 */
import type { Allocation, Claim, Config, PickMode, SessionState } from "../types";
import type { EnginePrize } from "../engine";

export interface AllocateInput {
  deviceId: string;
  onePerDevice: boolean;
  pickMode: PickMode;
  fallbackId: string | null;
  /** Prizes WITHOUT `given`; the store reads current stock itself inside the atomic section. */
  prizes: Omit<EnginePrize, "given">[];
  rand: number;
  now: number;
}

export type AllocateResult =
  | { kind: "ok" | "existing"; allocation: Allocation }
  | { kind: "none" };

export interface GiftStore {
  readonly name: "redis" | "memory" | string;

  // Configuration and session (small JSON documents)
  getConfig(): Promise<Config | null>;
  setConfig(config: Config): Promise<void>;
  getSession(): Promise<SessionState | null>;
  setSession(session: SessionState): Promise<void>;

  // Prize allocation
  /** Atomically: next turn number, choose prize (lib/engine.ts rules), decrement stock, save allocation. */
  allocate(input: AllocateInput): Promise<AllocateResult>;
  getAllocation(allocId: string): Promise<Allocation | null>;
  /** Total turns handed out so far (= gifts unwrapped). */
  getTurnCount(): Promise<number>;
  /** How many of each prize have been given out, keyed by prize id. */
  getGivenCounts(): Promise<Record<string, number>>;
  getJackpot(): Promise<{ turn: number; allocId: string } | null>;

  // Claims (leads)
  /** Reserve a gift code; false if it already exists. */
  reserveCode(code: string, allocId: string): Promise<boolean>;
  /** Insert a claim; false if this allocation already has one. */
  createClaim(claim: Claim): Promise<boolean>;
  updateClaim(claim: Claim): Promise<void>;
  getClaim(allocId: string): Promise<Claim | null>;
  getClaimByCode(code: string): Promise<Claim | null>;
  listClaims(): Promise<Claim[]>;
  countClaims(): Promise<number>;

  // Misc
  /** Fixed-window rate limit. Returns true when the call is allowed. */
  rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Rehearsal reset: wipe turns, stock counters, allocations, claims and codes. Config is kept. */
  resetEventData(): Promise<void>;
}

/** Allocation record format shared by stores: "turn|prizeId|at|deviceId" */
export function parseRecord(allocId: string, record: string): Allocation {
  const [turn, prizeId, at, deviceId] = record.split("|");
  return { allocId, turn: Number(turn), prizeId, at: Number(at), deviceId };
}
