import { json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

async function handle(code: string | null) {
  if (!code) return false;
  const store = getStore();
  const claim = await store.getClaimByCode(code.trim().toUpperCase());
  if (!claim) return false;
  if (!claim.unsubscribed) await store.updateClaim({ ...claim, unsubscribed: true });
  return true;
}

/** Form post from /unsubscribe, and RFC 8058 one-click unsubscribe from mail apps. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let code = url.searchParams.get("code");
  const ct = req.headers.get("content-type") ?? "";
  if (!code && ct.includes("form")) {
    const fd = await req.formData();
    code = String(fd.get("code") ?? "");
  }
  const ok = await handle(code);
  if (ct.includes("form") && !url.searchParams.has("code")) {
    return Response.redirect(new URL(`/unsubscribe?code=${encodeURIComponent(code ?? "")}&done=${ok ? 1 : 0}`, req.url), 303);
  }
  return json({ ok });
}
