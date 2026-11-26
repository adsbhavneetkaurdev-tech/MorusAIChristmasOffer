/**
 * Prize engine: the pure decision of WHICH prize a given turn receives.
 *
 * This function has no I/O. The stores call it (memoryStore) or mirror it
 * exactly in Lua (redisStore, see lib/store/allocate.lua) inside an atomic
 * section, so stock can never be oversold. tests/lua-parity.test.ts checks that
 * the Lua version and this version always agree.
 */
import type { Config, PickMode } from "./types";

export interface EnginePrize {
  id: string;
  quantity: number;
  given: number;
  chancePercent: number;
  guaranteedTurns: number[];
  isJackpot: boolean;
}

export interface ChooseInput {
  turn: number;
  /** Active prizes in display order (the fallback may be appended with chance 0). */
  prizes: EnginePrize[];
  pickMode: PickMode;
  /** Prize id given (without limit) when everything else is gone, or null for "all claimed". */
  fallbackId: string | null;
  /** Uniform random number in [0, 1). */
  rand: number;
}

export function choosePrize(input: ChooseInput): string | null {
  const { turn, prizes, pickMode, fallbackId, rand } = input;

  // 1. Guaranteed turns win, as long as stock is left.
  for (const p of prizes) {
    if (p.guaranteedTurns.includes(turn) && p.given < p.quantity) return p.id;
  }

  // 2. Random pick among prizes with stock. Stock reserved for future
  //    guaranteed turns is held back so e.g. the jackpot is never given early.
  const weights: { id: string; w: number }[] = [];
  let total = 0;
  for (const p of prizes) {
    if (p.chancePercent <= 0) continue;
    const reserved = p.guaranteedTurns.filter((t) => t > turn).length;
    const available = p.quantity - p.given - reserved;
    if (available <= 0) continue;
    const w = pickMode === "fixed_chance" ? p.chancePercent : available;
    weights.push({ id: p.id, w });
    total += w;
  }
  if (total > 0) {
    // Re-normalized automatically: we pick proportionally to the weights left.
    const r = rand * total;
    let acc = 0;
    for (const { id, w } of weights) {
      acc += w;
      if (r < acc) return id;
    }
    return weights[weights.length - 1].id;
  }

  // 3. Everything is gone: fallback (unlimited) or nothing.
  if (fallbackId && prizes.some((p) => p.id === fallbackId)) return fallbackId;
  return null;
}

/** Prizes handed to the engine: active ones, plus the fallback if it is switched off. */
export function enginePrizes(config: Config, given: Record<string, number>): EnginePrize[] {
  const list: EnginePrize[] = config.prizes
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      quantity: p.quantity,
      given: given[p.id] ?? 0,
      chancePercent: p.chancePercent,
      guaranteedTurns: p.guaranteedTurns,
      isJackpot: p.isJackpot,
    }));
  const fb = fallbackIdOf(config);
  if (fb && !list.some((p) => p.id === fb)) {
    const p = config.prizes.find((x) => x.id === fb)!;
    list.push({ id: p.id, quantity: 0, given: given[p.id] ?? 0, chancePercent: 0, guaranteedTurns: [], isJackpot: p.isJackpot });
  }
  return list;
}

export function fallbackIdOf(config: Config): string | null {
  if (!config.fallbackPrizeId || config.fallbackPrizeId === "none") return null;
  return config.prizes.some((p) => p.id === config.fallbackPrizeId) ? config.fallbackPrizeId : null;
}

/** Monte-Carlo odds check; touches no real data. */
export function simulate(config: Config, guests: number, runs: number) {
  const totals: Record<string, number> = {};
  let nothing = 0;
  let jackpotTurnSum = 0;
  let jackpotRuns = 0;
  const fb = fallbackIdOf(config);
  for (let r = 0; r < runs; r++) {
    const given: Record<string, number> = {};
    for (let turn = 1; turn <= guests; turn++) {
      const prizes = enginePrizes(config, given);
      const id = choosePrize({ turn, prizes, pickMode: config.pickMode, fallbackId: fb, rand: Math.random() });
      if (!id) {
        nothing++;
        continue;
      }
      given[id] = (given[id] ?? 0) + 1;
      totals[id] = (totals[id] ?? 0) + 1;
      const prize = config.prizes.find((p) => p.id === id);
      if (prize?.isJackpot && given[id] === 1) {
        jackpotTurnSum += turn;
        jackpotRuns++;
      }
    }
  }
  return {
    guests,
    runs,
    average: config.prizes.map((p) => ({
      id: p.id,
      name: p.name,
      average: (totals[p.id] ?? 0) / runs,
      quantity: p.quantity,
    })),
    averageNothing: nothing / runs,
    jackpotWonInPercentOfRuns: (jackpotRuns / runs) * 100,
    averageJackpotTurn: jackpotRuns ? jackpotTurnSum / jackpotRuns : null,
  };
}
