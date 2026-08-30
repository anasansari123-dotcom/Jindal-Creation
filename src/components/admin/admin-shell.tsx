"use client";

import { useRouter } from "next/navigation";
import { AdminSidebar, AdminHeader } from "@/components/admin/sidebar";
import type { SessionUser } from "@/lib/auth/session";

export function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AdminSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader user={user} onLogout={handleLogout} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-16 sm:p-5 lg:p-6 lg:pt-6 focus:outline-none"
        >
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
