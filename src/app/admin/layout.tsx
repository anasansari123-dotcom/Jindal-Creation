import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFreshSessionUser } from "@/lib/auth/load-user";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getFreshSessionUser();
  if (!user) {
    redirect("/api/auth/invalidate");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
