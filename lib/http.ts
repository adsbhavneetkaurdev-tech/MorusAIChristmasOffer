import { NextResponse } from "next/server";
import { isAdmin } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns a 401 response when the caller isn't the admin, otherwise null. */
export async function requireAdmin() {
  if (await isAdmin()) return null;
  return json({ error: "Not signed in" }, 401);
}

export function cleanDeviceId(v: unknown): string | null {
  const s = String(v ?? "");
  return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function siteUrl(req?: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
