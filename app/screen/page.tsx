import type { Metadata } from "next";
import { ProjectorScreen } from "@/components/projector/ProjectorScreen";
import { isAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/http";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gift Drop · Projector", robots: { index: false } };

export default async function ScreenPage() {
  return <ProjectorScreen siteUrl={siteUrl()} isAdmin={await isAdmin()} />;
}
