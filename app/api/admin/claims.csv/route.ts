import { requireAdmin } from "@/lib/http";
import { loadConfig } from "@/lib/service";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  let s = String(v ?? "");
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = getStore();
  const [claims, config] = await Promise.all([store.listClaims(), loadConfig(store)]);
  const header = ["Turn", "Name", "Brokerage", "Email", "Phone", "Prize", "Offer", "Jackpot", "Code", "Consent", "Email status", "Unsubscribed", "Claimed at"];
  const rows = claims.map((c) => [
    c.turn, c.name, c.company, c.email, c.phone, c.prizeLabel, config.offerSubject, c.isJackpot ? "yes" : "no", c.code,
    c.consent ? "yes" : "no", c.emailStatus, c.unsubscribed ? "yes" : "no", new Date(c.createdAt).toISOString(),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gift-drop-claims-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
