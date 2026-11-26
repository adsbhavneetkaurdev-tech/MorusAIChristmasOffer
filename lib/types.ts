// Shared data model for the Christmas Gift Drop.

export type OfferType = "months_free" | "percent_off" | "dollar_off";
export type PickMode = "fixed_chance" | "weighted_by_remaining";
export type SessionStatus = "waiting" | "live" | "paused" | "closed";

export interface Prize {
  id: string;
  name: string;
  active: boolean;
  offerType: OfferType;
  value: number;
  quantity: number;
  chancePercent: number;
  guaranteedTurns: number[];
  isJackpot: boolean;
}

export interface Config {
  prizes: Prize[];
  pickMode: PickMode;
  /** Prize id, or "none" */
  fallbackPrizeId: string;
  offerSubject: string;
  offerDescription: string;
  countdownMinutes: number;
  expectedGuests: number;
  onePerDevice: boolean;
  projectorSounds: boolean;
  hostName: string;
  bookingUrl: string;
  contactEmail: string;
}

export interface SessionState {
  status: SessionStatus;
  /** epoch ms when the countdown hits zero (live only) */
  endsAt: number | null;
  /** ms left while paused */
  pausedRemainingMs: number | null;
  startedAt: number | null;
  /** changes on every rehearsal reset so phones drop stale local state */
  runId: string;
}

export interface Allocation {
  allocId: string;
  deviceId: string;
  turn: number;
  prizeId: string;
  at: number;
}

export type EmailStatus = "pending" | "sent" | "failed" | "logged";

export interface Claim {
  allocId: string;
  deviceId: string;
  turn: number;
  prizeId: string;
  prizeLabel: string;
  isJackpot: boolean;
  name: string;
  email: string;
  company: string;
  phone: string;
  consent: boolean;
  code: string;
  createdAt: number;
  emailStatus: EmailStatus;
  emailError?: string;
  unsubscribed?: boolean;
}

export interface PublicPrize {
  id: string;
  name: string;
  label: string;
  shortLabel: string;
  offerType: OfferType;
  value: number;
  isJackpot: boolean;
}

export interface PublicConfig {
  hostName: string;
  bookingUrl: string;
  contactEmail: string;
  offerSubject: string;
  offerDescription: string;
  countdownMinutes: number;
  onePerDevice: boolean;
  projectorSounds: boolean;
  prizes: PublicPrize[];
}

export interface SessionResponse {
  status: SessionStatus;
  endsAt: number | null;
  remainingMs: number;
  serverNow: number;
  unwrappedCount: number;
  claimedCount: number;
  jackpotTaken: boolean;
  jackpotTurn: number | null;
  runId: string;
  publicConfig: PublicConfig;
}

export interface RevealPrize {
  id: string;
  label: string;
  isJackpot: boolean;
  offerType: OfferType;
  value: number;
}
