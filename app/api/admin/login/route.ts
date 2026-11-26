import { ADMIN_COOKIE, checkPassword, cookieOptions, createSessionToken } from "@/lib/auth";
import { clientIp, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const store = getStore();
  if (!(await store.rateLimit(`login:${clientIp(req)}`, 10, 300)))
    return json({ error: "Too many attempts. Try again in a few minutes." }, 429);
  const body = await readJson(req);
  if (!checkPassword(String(body.password ?? ""))) return json({ error: "Wrong password" }, 401);
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), cookieOptions);
  return res;
}
