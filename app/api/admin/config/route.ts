import { json, readJson, requireAdmin } from "@/lib/http";
import { loadConfig } from "@/lib/service";
import { getStore } from "@/lib/store";
import { sanitizeConfig, validateConfig } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = getStore();
  const [config, given] = await Promise.all([loadConfig(store), store.getGivenCounts()]);
  return json({ config, given, storage: store.name });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const store = getStore();
  const config = sanitizeConfig(await readJson(req));
  const given = await store.getGivenCounts();
  const { errors } = validateConfig(config, given);
  if (errors.length) return json({ error: errors[0], errors }, 400);
  await store.setConfig(config);
  return json({ ok: true, config, given });
}
