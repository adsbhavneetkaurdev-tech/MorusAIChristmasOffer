import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { PreviewGallery } from "@/components/preview/PreviewGallery";
import { isAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/http";
import { loadConfig } from "@/lib/service";
import { toPublicConfig } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gift Drop · Preview", robots: { index: false, follow: false } };

export default async function PreviewPage() {
  if (!(await isAdmin())) return <LoginForm next="/preview" />;
  const config = await loadConfig();
  return <PreviewGallery config={toPublicConfig(config)} siteUrl={siteUrl()} />;
}
