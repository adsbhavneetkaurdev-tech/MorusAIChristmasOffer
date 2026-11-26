import { cleanDeviceId, json } from "@/lib/http";
import { loadConfig, toReveal } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Lets a phone recover its gift (and code) after a refresh. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = cleanDeviceId(url.searchParams.get("deviceId"));
  if (!deviceId) return json({ error: "Missing device id" }, 400);
  const allocParam = url.searchParams.get("allocId");
  const allocId = allocParam && allocParam.startsWith(deviceId) ? allocParam : deviceId;

  const store = getStore();
  const [config, alloc, claim] = await Promise.all([loadConfig(store), store.getAllocation(allocId), store.getClaim(allocId)]);
  if (!alloc) return json({ allocation: null, claim: null });
  return json({
    allocation: { allocId: alloc.allocId, turn: alloc.turn, prize: toReveal(config, alloc.prizeId) },
    claim: claim ? { code: claim.code, prizeLabel: claim.prizeLabel, email: claim.email } : null,
  });
}
