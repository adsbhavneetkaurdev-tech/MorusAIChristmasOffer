import { json, requireAdmin } from "@/lib/http";
import { loadConfig, loadSession, remainingMs } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = getStore();
  const [config, session, turns, claimed, given, jackpot] = await Promise.all([
    loadConfig(store), loadSession(store), store.getTurnCount(), store.countClaims(), store.getGivenCounts(), store.getJackpot(),
  ]);
  const jackpotClaim = jackpot ? await store.getClaim(jackpot.allocId) : null;
  const now = Date.now();
  const left = config.prizes.filter((p) => p.active).reduce((s, p) => s + Math.max(0, p.quantity - (given[p.id] ?? 0)), 0);
  const jackpotPrize = config.prizes.find((p) => p.isJackpot && p.active);
  return json({
    serverNow: now,
    session: { ...session, remainingMs: remainingMs(session, config, now) },
    unwrapped: turns,
    expectedGuests: config.expectedGuests,
    claimed,
    giftsLeft: left,
    fallbackName: config.prizes.find((p) => p.id === config.fallbackPrizeId)?.name ?? null,
    given,
    jackpot: {
      configured: !!jackpotPrize,
      turns: jackpotPrize?.guaranteedTurns ?? [],
      won: jackpot ? { turn: jackpot.turn, name: jackpotClaim?.name ?? null, company: jackpotClaim?.company ?? null } : null,
    },
    storage: store.name,
    emailMode: process.env.RESEND_API_KEY ? "resend" : "console",
  });
}
