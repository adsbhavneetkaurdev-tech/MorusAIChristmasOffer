/**
 * Server-side business logic used by the API routes. Never import from client code.
 */
import { randomBytes, randomInt } from "node:crypto";
import { defaultConfig } from "./defaults";
import { enginePrizes, fallbackIdOf } from "./engine";
import { codePrefix, prizeLabel, toPublicConfig, withSubject } from "./labels";
import { getStore, type GiftStore } from "./store";
import type { Claim, Config, RevealPrize, SessionResponse, SessionState } from "./types";

export async function loadConfig(store: GiftStore = getStore()): Promise<Config> {
  const c = await store.getConfig();
  if (c) return { ...defaultConfig(), ...c };
  const fresh = defaultConfig();
  await store.setConfig(fresh);
  return fresh;
}

export function newRunId() {
  return randomBytes(6).toString("hex");
}

export async function loadSession(store: GiftStore = getStore()): Promise<SessionState> {
  const s = await store.getSession();
  if (!s) {
    const fresh: SessionState = { status: "waiting", endsAt: null, pausedRemainingMs: null, startedAt: null, runId: newRunId() };
    await store.setSession(fresh);
    return fresh;
  }
  if (s.status === "live" && s.endsAt != null && s.endsAt <= Date.now()) {
    const closed: SessionState = { ...s, status: "closed" };
    await store.setSession(closed);
    return closed;
  }
  return s;
}

export function remainingMs(s: SessionState, config: Config, now = Date.now()): number {
  if (s.status === "live") return Math.max(0, (s.endsAt ?? now) - now);
  if (s.status === "paused") return Math.max(0, s.pausedRemainingMs ?? 0);
  if (s.status === "waiting") return config.countdownMinutes * 60_000;
  return 0;
}

export async function sessionResponse(store: GiftStore = getStore()): Promise<SessionResponse> {
  const [config, session, turns, claims, jackpot] = await Promise.all([
    loadConfig(store),
    loadSession(store),
    store.getTurnCount(),
    store.countClaims(),
    store.getJackpot(),
  ]);
  const now = Date.now();
  return {
    status: session.status,
    endsAt: session.status === "live" ? session.endsAt : null,
    remainingMs: remainingMs(session, config, now),
    serverNow: now,
    unwrappedCount: turns,
    claimedCount: claims,
    jackpotTaken: !!jackpot,
    jackpotTurn: jackpot?.turn ?? null,
    runId: session.runId,
    publicConfig: toPublicConfig(config),
  };
}

export function toReveal(config: Config, prizeId: string): RevealPrize {
  const p = config.prizes.find((x) => x.id === prizeId);
  if (!p) return { id: prizeId, label: "A Christmas gift", isJackpot: false, offerType: "months_free", value: 1 };
  return { id: p.id, label: prizeLabel(p), isJackpot: p.isJackpot, offerType: p.offerType, value: p.value };
}

export type UnwrapOutcome =
  | { ok: true; allocId: string; turn: number; prize: RevealPrize; existing: boolean }
  | { ok: false; reason: "not_live" | "all_claimed"; status?: string };

export async function unwrap(deviceId: string, store: GiftStore = getStore()): Promise<UnwrapOutcome> {
  const [config, session] = await Promise.all([loadConfig(store), loadSession(store)]);
  if (config.onePerDevice) {
    // A returning phone always gets its original gift, whatever the status.
    const existing = await store.getAllocation(deviceId);
    if (existing)
      return { ok: true, allocId: existing.allocId, turn: existing.turn, prize: toReveal(config, existing.prizeId), existing: true };
  }
  if (session.status !== "live") return { ok: false, reason: "not_live", status: session.status };

  const prizes = enginePrizes(config, {}).map(({ given: _g, ...p }) => p);
  const res = await store.allocate({
    deviceId,
    onePerDevice: config.onePerDevice,
    pickMode: config.pickMode,
    fallbackId: fallbackIdOf(config),
    prizes,
    rand: Math.random(),
    now: Date.now(),
  });
  if (res.kind === "none") return { ok: false, reason: "all_claimed" };
  const a = res.allocation;
  return { ok: true, allocId: a.allocId, turn: a.turn, prize: toReveal(config, a.prizeId), existing: res.kind === "existing" };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function randomCodeSuffix(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export async function createUniqueCode(prefix: string, allocId: string, store: GiftStore): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const code = `MORUS-${prefix}-${randomCodeSuffix(attempt < 20 ? 4 : 6)}`;
    if (await store.reserveCode(code, allocId)) return code;
  }
  throw new Error("Could not generate a unique code");
}

export interface ClaimInput {
  deviceId: string;
  allocId?: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  consent: boolean;
}

export function validateClaimInput(input: ClaimInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name || input.name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.email?.trim() ?? "")) errors.email = "Please enter a valid email address.";
  if (!input.company || input.company.trim().length < 2) errors.company = "Please enter your brokerage or company.";
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.phone = "Please enter a mobile number, e.g. (780) 555-0123.";
  if (!input.consent) errors.consent = "Please tick the box so we can send your gift.";
  return errors;
}

export type ClaimOutcome =
  | { ok: true; claim: Claim; existing: boolean }
  | { ok: false; status: number; error: string; fields?: Record<string, string> };

export async function claimGift(input: ClaimInput, store: GiftStore = getStore()): Promise<ClaimOutcome> {
  const fields = validateClaimInput(input);
  if (Object.keys(fields).length) return { ok: false, status: 400, error: "Please check the highlighted fields.", fields };

  const config = await loadConfig(store);
  const allocId = config.onePerDevice || !input.allocId ? input.deviceId : input.allocId;
  if (!allocId.startsWith(input.deviceId)) return { ok: false, status: 403, error: "This gift belongs to another device." };
  const alloc = await store.getAllocation(allocId);
  if (!alloc) return { ok: false, status: 404, error: "We couldn't find your gift. Please unwrap it first." };

  const prev = await store.getClaim(allocId);
  if (prev) return { ok: true, claim: prev, existing: true };

  const prize = config.prizes.find((p) => p.id === alloc.prizeId);
  const offer = prize ?? { offerType: "months_free" as const, value: 1 };
  const code = await createUniqueCode(codePrefix(offer), allocId, store);
  const claim: Claim = {
    allocId,
    deviceId: input.deviceId,
    turn: alloc.turn,
    prizeId: alloc.prizeId,
    prizeLabel: prizeLabel(offer),
    isJackpot: !!prize?.isJackpot,
    name: input.name.trim().slice(0, 120),
    email: input.email.trim().toLowerCase().slice(0, 200),
    company: input.company.trim().slice(0, 160),
    phone: input.phone.trim().slice(0, 40),
    consent: true,
    code,
    createdAt: Date.now(),
    emailStatus: "pending",
  };
  const inserted = await store.createClaim(claim);
  if (!inserted) {
    const winner = await store.getClaim(allocId);
    if (winner) return { ok: true, claim: winner, existing: true };
  }
  return { ok: true, claim, existing: false };
}

export function giftLine(claim: Pick<Claim, "prizeLabel">, config: Config) {
  return withSubject(claim.prizeLabel, config.offerSubject);
}
