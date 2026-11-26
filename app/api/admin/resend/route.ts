import { sendGiftEmail } from "@/lib/email";
import { json, readJson, requireAdmin, siteUrl } from "@/lib/http";
import { loadConfig } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { allocId } = await readJson(req);
  const store = getStore();
  const claim = await store.getClaim(String(allocId ?? ""));
  if (!claim) return json({ error: "Claim not found" }, 404);
  const sent = await sendGiftEmail(claim, await loadConfig(store), siteUrl(req));
  const updated = { ...claim, emailStatus: sent.status, emailError: sent.error };
  await store.updateClaim(updated);
  return json({ ok: sent.status !== "failed", claim: updated });
}
