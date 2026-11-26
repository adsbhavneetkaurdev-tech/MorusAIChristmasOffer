import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gift Drop Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <LoginForm />;
  return <AdminDashboard />;
}
