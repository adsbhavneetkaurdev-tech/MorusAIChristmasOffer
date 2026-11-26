import { json } from "@/lib/http";
import { sessionResponse } from "@/lib/service";
import type { SessionResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// Tiny per-instance cache: 120 phones polling every few seconds share one read.
let cache: { at: number; data: SessionResponse } | null = null;
let inflight: Promise<SessionResponse> | null = null;
const TTL_MS = 1000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return json({ ...cache.data, serverNow: Date.now() });
  if (!inflight) {
    inflight = sessionResponse()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const data = await inflight;
  const t = Date.now();
  // Recompute remaining time against the real "now" when serving from cache.
  const remainingMs = data.status === "live" && data.endsAt ? Math.max(0, data.endsAt - t) : data.remainingMs;
  return json({ ...data, remainingMs, serverNow: t });
}
