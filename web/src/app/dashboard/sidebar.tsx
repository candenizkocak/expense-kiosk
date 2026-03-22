"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthenticatedUser } from "@/lib/types";
import { useTheme } from "@/components/theme-provider";
import {
  Receipt,
  LogOut,
  LayoutDashboard,
  ClipboardCheck,
  Shield,
  Users,
  UserCircle,
  BarChart3,
  Building2,
  Sun,
  Moon,
  Settings,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function getNavItems(role: AuthenticatedUser["table"]): NavItem[] {
  if (role === "admins") {
    return [
      { href: "/dashboard/admin", label: "All expenses", icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: "/dashboard/admin/people", label: "People", icon: <Users className="w-4 h-4" /> },
      { href: "/dashboard/admin/analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { href: "/dashboard/admin/settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    ];
  }
  if (role === "managers") {
    return [
      { href: "/dashboard/manage", label: "Approve expenses", icon: <ClipboardCheck className="w-4 h-4" /> },
      { href: "/dashboard/team", label: "Team overview", icon: <Users className="w-4 h-4" /> },
    ];
  }
  return [
    { href: "/dashboard", label: "My expenses", icon: <LayoutDashboard className="w-4 h-4" /> },
  ];
}

function getRoleBadge(role: AuthenticatedUser["table"]) {
  switch (role) {
    case "admins":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-kiosk-danger/10 text-kiosk-danger border border-kiosk-danger/20">
          <Shield className="w-3 h-3" />
          Admin
        </span>
      );
    case "managers":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-kiosk-accent/10 text-kiosk-accent border border-kiosk-accent/20">
          <Building2 className="w-3 h-3" />
          Manager
        </span>
      );
    default:
      return (
        <span className="text-xs text-kiosk-muted">Employee</span>
      );
  }
}

export function Sidebar({ profile }: { profile: AuthenticatedUser }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const navItems = getNavItems(profile.table);

  return (
    <aside className="w-64 bg-kiosk-surface border-r border-kiosk-border flex flex-col flex-shrink-0">
      {/* User info */}
      <div className="p-5 border-b border-kiosk-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kiosk-accent/10 border border-kiosk-accent/20 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-kiosk-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{profile.name}</p>
            {getRoleBadge(profile.table)}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-kiosk-accent/10 text-kiosk-accent border border-kiosk-accent/20"
                  : "text-kiosk-muted hover:text-kiosk-text hover:bg-kiosk-bg border border-transparent"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-kiosk-border">
          <Link
            href="/dashboard/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              pathname === "/dashboard/profile"
                ? "bg-kiosk-accent/10 text-kiosk-accent border border-kiosk-accent/20"
                : "text-kiosk-muted hover:text-kiosk-text hover:bg-kiosk-bg border border-transparent"
            }`}
          >
            <UserCircle className="w-4 h-4" />
            Profile
          </Link>
        </div>
      </nav>

      {/* Theme toggle + Sign out */}
      <div className="p-3 border-t border-kiosk-border space-y-0.5">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-kiosk-muted hover:text-kiosk-text hover:bg-kiosk-bg transition-colors w-full border border-transparent"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-kiosk-muted hover:text-kiosk-danger hover:bg-kiosk-danger/5 transition-colors w-full border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
