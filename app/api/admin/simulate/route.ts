import { simulate } from "@/lib/engine";
import { json, readJson, requireAdmin } from "@/lib/http";
import { loadConfig } from "@/lib/service";
import { sanitizeConfig } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Runs the odds 1,000 times in memory. Never touches real data. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson(req);
  const config = body.config ? sanitizeConfig(body.config) : await loadConfig();
  const guests = Math.min(2000, Math.max(1, Number(body.guests) || config.expectedGuests));
  const runs = Math.min(2000, Math.max(10, Number(body.runs) || 1000));
  return json(simulate(config, guests, runs));
}
