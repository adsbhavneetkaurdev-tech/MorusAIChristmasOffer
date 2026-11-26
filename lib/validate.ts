import type { Config, Prize } from "./types";

export interface ValidationResult {
  errors: string[];
  chanceTotal: number;
}

export function chanceTotal(prizes: Prize[]): number {
  return Math.round(prizes.filter((p) => p.active).reduce((s, p) => s + (Number(p.chancePercent) || 0), 0) * 100) / 100;
}

/** Shared by the admin UI (live) and the server (on save). */
export function validateConfig(c: Config, given: Record<string, number> = {}): ValidationResult {
  const errors: string[] = [];
  const total = chanceTotal(c.prizes);
  const ids = new Set<string>();
  const turnOwner = new Map<number, string>();

  if (c.prizes.length === 0) errors.push("Add at least one prize.");
  for (const p of c.prizes) {
    const label = p.name || "(unnamed prize)";
    if (!p.name.trim()) errors.push("Every prize needs a name.");
    if (!/^[a-z0-9-]{1,40}$/.test(p.id)) errors.push(`${label}: invalid internal id.`);
    if (ids.has(p.id)) errors.push(`${label}: duplicate id.`);
    ids.add(p.id);
    if (!["months_free", "percent_off", "dollar_off"].includes(p.offerType)) errors.push(`${label}: pick an offer type.`);
    if (!Number.isFinite(p.value) || p.value <= 0) errors.push(`${label}: value must be more than 0.`);
    if (p.offerType === "percent_off" && p.value > 100) errors.push(`${label}: a discount can't be more than 100%.`);
    if (!Number.isInteger(p.quantity) || p.quantity < 0) errors.push(`${label}: quantity must be a whole number.`);
    const out = given[p.id] ?? 0;
    if (p.quantity < out) errors.push(`${label}: quantity can't go below the ${out} already given out.`);
    if (!Number.isFinite(p.chancePercent) || p.chancePercent < 0 || p.chancePercent > 100)
      errors.push(`${label}: chance must be between 0 and 100.`);
    for (const t of p.guaranteedTurns) {
      if (!Number.isInteger(t) || t < 1) errors.push(`${label}: turn numbers must be whole numbers from 1.`);
      const owner = turnOwner.get(t);
      if (owner && owner !== p.id) errors.push(`Turn #${t} is guaranteed to more than one prize.`);
      turnOwner.set(t, p.id);
    }
    if (p.guaranteedTurns.length > p.quantity)
      errors.push(`${label}: more "always won" turns than quantity.`);
  }
  if (c.pickMode === "fixed_chance" && Math.abs(total - 100) > 0.01 && c.prizes.some((p) => p.active && p.chancePercent > 0))
    errors.push(`Chances of active prizes must add up to 100% (now ${total}%).`);
  if (c.pickMode === "fixed_chance" && !c.prizes.some((p) => p.active && p.chancePercent > 0))
    errors.push("At least one active prize needs a chance above 0%.");
  if (c.fallbackPrizeId !== "none" && !c.prizes.some((p) => p.id === c.fallbackPrizeId))
    errors.push("The fallback prize no longer exists. Pick another or choose Nothing.");
  if (!Number.isFinite(c.countdownMinutes) || c.countdownMinutes < 1 || c.countdownMinutes > 180)
    errors.push("Countdown must be between 1 and 180 minutes.");
  if (!Number.isInteger(c.expectedGuests) || c.expectedGuests < 1) errors.push("Expected guests must be at least 1.");
  if (!/^https?:\/\//.test(c.bookingUrl)) errors.push("Booking link must start with https://");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.contactEmail)) errors.push("Contact email looks wrong.");
  if (!c.hostName.trim()) errors.push("Host name is required.");

  return { errors: [...new Set(errors)], chanceTotal: total };
}

/** Scale active chances so they add to exactly 100 (whole numbers). */
export function balanceChances(prizes: Prize[]): Prize[] {
  const eligible = prizes.filter((p) => p.active && p.chancePercent > 0);
  let pool = eligible;
  if (pool.length === 0) pool = prizes.filter((p) => p.active && p.guaranteedTurns.length === 0);
  if (pool.length === 0) return prizes;
  const sum = pool.reduce((s, p) => s + (eligible.length ? p.chancePercent : 1), 0);
  const raw = pool.map((p) => ((eligible.length ? p.chancePercent : 1) / sum) * 100);
  const floored = raw.map(Math.floor);
  let rest = 100 - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    floored[i]++;
    rest--;
  }
  const map = new Map(pool.map((p, i) => [p.id, floored[i]]));
  return prizes.map((p) => (map.has(p.id) ? { ...p, chancePercent: map.get(p.id)! } : p));
}

/** Coerce untrusted JSON into a Config shape (types only; validateConfig checks the rules). */
export function sanitizeConfig(input: unknown): Config {
  const c = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 300) => String(v ?? "").slice(0, max).trim();
  const num = (v: unknown) => Number(v);
  const prizes = Array.isArray(c.prizes) ? c.prizes : [];
  return {
    prizes: prizes.slice(0, 50).map((raw) => {
      const p = (raw ?? {}) as Record<string, unknown>;
      const turns = Array.isArray(p.guaranteedTurns) ? p.guaranteedTurns : [];
      return {
        id: str(p.id, 40),
        name: str(p.name, 80),
        active: Boolean(p.active),
        offerType: str(p.offerType) as Prize["offerType"],
        value: num(p.value),
        quantity: num(p.quantity),
        chancePercent: num(p.chancePercent),
        guaranteedTurns: [...new Set(turns.map(num))].sort((a, b) => a - b),
        isJackpot: Boolean(p.isJackpot),
      };
    }),
    pickMode: c.pickMode === "weighted_by_remaining" ? "weighted_by_remaining" : "fixed_chance",
    fallbackPrizeId: str(c.fallbackPrizeId, 40) || "none",
    offerSubject: str(c.offerSubject, 80),
    offerDescription: str(c.offerDescription, 160),
    countdownMinutes: num(c.countdownMinutes),
    expectedGuests: num(c.expectedGuests),
    onePerDevice: Boolean(c.onePerDevice),
    projectorSounds: Boolean(c.projectorSounds),
    hostName: str(c.hostName, 80),
    bookingUrl: str(c.bookingUrl, 500),
    contactEmail: str(c.contactEmail, 200),
  };
}
