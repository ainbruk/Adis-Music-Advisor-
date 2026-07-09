"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Waves,
  LayoutDashboard,
  Music2,
  User2,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/recommendations", label: "Empfehlungen", icon: Music2, exact: false },
  { href: "/dashboard/history", label: "Verlauf", icon: History, exact: false },
  { href: "/dashboard/profile", label: "Mein Profil", icon: User2, exact: false },
];

export function Navigation({ user }: NavProps) {
  const pathname = usePathname();
  // Zugeklappt starten – auf dem Desktop nach dem Laden automatisch öffnen
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (window.innerWidth >= 1024) setCollapsed(false);
  }, []);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={`
        relative flex flex-col
        ${collapsed ? "w-16" : "w-56"}
        transition-all duration-300
        bg-surface-800 border-r border-white/5 h-screen sticky top-0
      `}
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-2.5 border-b border-white/5">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0 glow-purple">
          <Waves className="w-4 h-4 text-on-brand" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base gradient-text truncate">
            CuratedVibe
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${active
                  ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? ""}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-on-brand">
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">
                {user.name ?? "Nutzer"}
              </p>
              <p className="text-xs text-white/35 truncate">{user.email}</p>
            </div>
          </div>
        )}

        <ThemeToggle showLabel={!collapsed} />

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Abmelden"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-surface-700 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 hover:border-brand-500/50 transition-all z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
