import { cleanDeviceId, clientIp, json, readJson } from "@/lib/http";
import { unwrap } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const deviceId = cleanDeviceId(body.deviceId);
  if (!deviceId) return json({ error: "Missing device id" }, 400);

  const store = getStore();
  const ip = clientIp(req);
  // Event Wi-Fi often puts everyone behind ONE public IP, so the IP limit is generous.
  const [ipOk, devOk] = await Promise.all([
    store.rateLimit(`unwrap:ip:${ip}`, 300, 60),
    store.rateLimit(`unwrap:dev:${deviceId}`, 15, 60),
  ]);
  if (!ipOk || !devOk) return json({ error: "Too many taps. Give it a few seconds and try again." }, 429);

  const res = await unwrap(deviceId, store);
  if (!res.ok) {
    if (res.reason === "all_claimed") return json({ error: "All gifts have been claimed", reason: "all_claimed" }, 410);
    return json({ error: "The gift drop isn't open right now", reason: "not_live", status: res.status }, 409);
  }
  return json({ allocId: res.allocId, turn: res.turn, prize: res.prize, existing: res.existing });
}
