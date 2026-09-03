"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Truck,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  History,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Permission } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth/session";

const navItems: { href: string; label: string; icon: React.ElementType; permission: Permission }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/admin/products", label: "Create Product", icon: Package, permission: "products" },
  { href: "/admin/products/history", label: "Product History", icon: History, permission: "products" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers" },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse, permission: "inventory" },
  { href: "/admin/orders", label: "Bills & Orders", icon: ShoppingCart, permission: "orders" },
  { href: "/admin/sales", label: "Sales", icon: TrendingUp, permission: "sales" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "payments" },
  { href: "/admin/dispatch", label: "Create Bill", icon: Truck, permission: "dispatch" },
  { href: "/admin/returns", label: "Product Returns", icon: RotateCcw, permission: "dispatch" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { href: "/admin/users", label: "Users", icon: UserCog, permission: "users" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings" },
];

function hasAccess(user: SessionUser, permission: Permission) {
  if (user.role === "MAIN_ADMIN") return true;
  return user.permissions.includes(permission);
}

export function AdminSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const filteredNav = navItems.filter((item) => hasAccess(user, item.permission));

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside
      id="admin-sidebar"
      className="flex h-full w-64 flex-col bg-navy text-white"
    >
      <div className="border-b border-white/10 p-4">
        <Logo size="sm" href="/admin/dashboard" theme="light" />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Admin navigation">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin/products"
              ? pathname === "/admin/products"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-gold text-navy font-medium"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="text-xs text-white/80 truncate">{user.name}</p>
        <p className="text-xs text-gold">{user.role === "MAIN_ADMIN" ? "Main Admin" : "Staff Admin"}</p>
      </div>
    </aside>
  );

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        className="fixed top-4 left-4 z-40 rounded-lg bg-navy p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
      >
        {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </div>
    </>
  );
}

export function AdminHeader({
  user,
  onLogout,
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    type: string;
    label: string;
    sublabel: string;
    href: string;
  }>>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.results || []);
    setShowResults(true);
  }, []);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(q), 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-2 border-b border-gray-100 bg-white px-3 sm:px-4 lg:px-6">
      <div className="relative ml-10 sm:ml-12 lg:ml-0 flex-1 min-w-0 max-w-md">
        <label htmlFor="admin-search" className="sr-only">
          Search customers, products, orders
        </label>
        <input
          id="admin-search"
          type="search"
          role="combobox"
          aria-expanded={showResults && searchResults.length > 0}
          aria-controls="admin-search-results"
          aria-autocomplete="list"
          placeholder="Search customers, products, orders..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        {showResults && searchResults.length > 0 && (
          <ul
            id="admin-search-results"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-white shadow-lg z-50 list-none m-0 p-0"
          >
            {searchResults.map((r, i) => (
              <li key={`${r.href}-${i}`} role="option">
                <Link
                  href={r.href}
                  className="block px-4 py-2 hover:bg-gray-50 text-sm"
                >
                  <span className="font-medium text-navy">{r.label}</span>
                  <span className="ml-2 text-gray-600 text-xs">{r.sublabel}</span>
                  <span className="ml-2 text-xs text-wood capitalize">{r.type}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium text-navy">{user.name}</p>
          <p className="text-xs text-gray-600">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
