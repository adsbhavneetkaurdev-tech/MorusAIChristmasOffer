import { defaultConfig } from "@/lib/defaults";
import { json, readJson, requireAdmin } from "@/lib/http";
import { loadConfig, loadSession, newRunId, remainingMs } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { SessionState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = getStore();
  const { action } = await readJson(req);
  const [config, s] = await Promise.all([loadConfig(store), loadSession(store)]);
  const now = Date.now();
  let next: SessionState = s;

  switch (action) {
    case "start":
      if (s.status === "live") break;
      if (s.status === "paused") {
        next = { ...s, status: "live", endsAt: now + (s.pausedRemainingMs ?? 0), pausedRemainingMs: null };
      } else {
        next = { ...s, status: "live", endsAt: now + config.countdownMinutes * 60_000, pausedRemainingMs: null, startedAt: now };
      }
      break;
    case "pause":
      if (s.status !== "live") return json({ error: "Not live" }, 409);
      next = { ...s, status: "paused", pausedRemainingMs: remainingMs(s, config, now), endsAt: null };
      break;
    case "resume":
      if (s.status !== "paused") return json({ error: "Not paused" }, 409);
      next = { ...s, status: "live", endsAt: now + (s.pausedRemainingMs ?? 0), pausedRemainingMs: null };
      break;
    case "add_minute":
      if (s.status === "live") next = { ...s, endsAt: (s.endsAt ?? now) + 60_000 };
      else if (s.status === "paused") next = { ...s, pausedRemainingMs: (s.pausedRemainingMs ?? 0) + 60_000 };
      else return json({ error: "Not running" }, 409);
      break;
    case "close":
      next = { ...s, status: "closed", endsAt: null, pausedRemainingMs: null };
      break;
    case "reset":
      await store.resetEventData();
      next = { status: "waiting", endsAt: null, pausedRemainingMs: null, startedAt: null, runId: newRunId() };
      break;
    case "reset_defaults":
      await store.setConfig(defaultConfig());
      return json({ ok: true });
    default:
      return json({ error: "Unknown action" }, 400);
  }
  await store.setSession(next);
  return json({ ok: true, session: next });
}
