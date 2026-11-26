import { sendGiftEmail } from "@/lib/email";
import { cleanDeviceId, clientIp, json, readJson, siteUrl } from "@/lib/http";
import { claimGift, loadConfig } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const deviceId = cleanDeviceId(body.deviceId);
  if (!deviceId) return json({ error: "Missing device id" }, 400);

  const store = getStore();
  const ip = clientIp(req);
  const [ipOk, devOk] = await Promise.all([
    store.rateLimit(`claim:ip:${ip}`, 200, 60),
    store.rateLimit(`claim:dev:${deviceId}`, 10, 60),
  ]);
  if (!ipOk || !devOk) return json({ error: "Too many attempts. Please wait a moment and try again." }, 429);

  const res = await claimGift(
    {
      deviceId,
      allocId: typeof body.allocId === "string" ? body.allocId : undefined,
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      company: String(body.company ?? ""),
      phone: String(body.phone ?? ""),
      consent: body.consent === true,
    },
    store,
  );
  if (!res.ok) return json({ error: res.error, fields: res.fields }, res.status);

  let claim = res.claim;
  if (!res.existing) {
    const config = await loadConfig(store);
    const sent = await sendGiftEmail(claim, config, siteUrl(req));
    claim = { ...claim, emailStatus: sent.status, emailError: sent.error };
    await store.updateClaim(claim);
  }
  return json({ code: claim.code, prizeLabel: claim.prizeLabel, isJackpot: claim.isJackpot, email: claim.email });
}
