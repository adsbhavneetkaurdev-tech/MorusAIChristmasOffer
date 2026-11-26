import type { Config, OfferType, Prize, PublicConfig, PublicPrize } from "./types";

type OfferLike = { offerType: OfferType; value: number };

/** "3 Months FREE", "1 Full Year FREE", "25% OFF", "$500 OFF" */
export function prizeLabel(p: OfferLike): string {
  if (p.offerType === "percent_off") return `${p.value}% OFF`;
  if (p.offerType === "dollar_off") return `$${p.value.toLocaleString("en-CA")} OFF`;
  if (p.value === 12) return "1 Full Year FREE";
  if (p.value % 12 === 0) return `${p.value / 12} Years FREE`;
  return `${p.value} Month${p.value === 1 ? "" : "s"} FREE`;
}

/** Lower-case text: "3 months free", "1 year free", "25% off" */
export function shortLabel(p: OfferLike): string {
  if (p.offerType === "percent_off") return `${p.value}% off`;
  if (p.offerType === "dollar_off") return `$${p.value.toLocaleString("en-CA")} off`;
  if (p.value % 12 === 0) return p.value === 12 ? "1 year free" : `${p.value / 12} years free`;
  return `${p.value} month${p.value === 1 ? "" : "s"} free`;
}

/** Projector pill text: "6 months free", jackpot "1 year · JACKPOT" */
export function pillLabel(p: OfferLike & { isJackpot: boolean }): string {
  const s = shortLabel(p);
  return p.isJackpot ? `${s.replace(/ free$/, "")} · JACKPOT` : s;
}

/** Two-line display for the reveal: big headline + optional "FREE" line. */
export function revealLines(p: OfferLike): { big: string; small: string | null } {
  if (p.offerType === "percent_off") return { big: `${p.value}% OFF`, small: null };
  if (p.offerType === "dollar_off") return { big: `$${p.value.toLocaleString("en-CA")} OFF`, small: null };
  if (p.value === 12) return { big: "1 Full Year", small: "FREE" };
  if (p.value % 12 === 0) return { big: `${p.value / 12} Years`, small: "FREE" };
  return { big: `${p.value} Month${p.value === 1 ? "" : "s"}`, small: "FREE" };
}

/** Phrase used in sentences: "a full year of", "3 months of", "25% off" */
export function offerPhrase(p: OfferLike): string {
  if (p.offerType === "percent_off") return `${p.value}% off`;
  if (p.offerType === "dollar_off") return `$${p.value.toLocaleString("en-CA")} off`;
  if (p.value === 12) return "a full year of";
  if (p.value % 12 === 0) return `${p.value / 12} years of`;
  return `${p.value} month${p.value === 1 ? "" : "s"} of`;
}

/** Code prefix: 1Y, 6M, 3M, 1M, 25P, 500D */
export function codePrefix(p: OfferLike): string {
  if (p.offerType === "percent_off") return `${p.value}P`;
  if (p.offerType === "dollar_off") return `${p.value}D`;
  if (p.value % 12 === 0) return `${p.value / 12}Y`;
  return `${p.value}M`;
}

export function withSubject(label: string, subject: string): string {
  return subject ? `${label} · ${subject}` : label;
}

export function toPublicPrize(p: Prize): PublicPrize {
  return {
    id: p.id,
    name: p.name,
    label: prizeLabel(p),
    shortLabel: shortLabel(p),
    offerType: p.offerType,
    value: p.value,
    isJackpot: p.isJackpot,
  };
}

export function toPublicConfig(c: Config): PublicConfig {
  return {
    hostName: c.hostName,
    bookingUrl: c.bookingUrl,
    contactEmail: c.contactEmail,
    offerSubject: c.offerSubject,
    offerDescription: c.offerDescription,
    countdownMinutes: c.countdownMinutes,
    onePerDevice: c.onePerDevice,
    projectorSounds: c.projectorSounds,
    prizes: c.prizes.filter((p) => p.active).map(toPublicPrize),
  };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
