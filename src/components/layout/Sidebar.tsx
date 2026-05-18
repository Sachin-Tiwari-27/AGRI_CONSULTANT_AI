"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  LogOut,
  Leaf,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/* ── Sidebar ──────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="group/sidebar flex flex-col h-screen bg-card border-r border-border sticky top-0 flex-shrink-0 w-[60px] hover:w-[220px] transition-[width] duration-200 ease-in-out overflow-hidden z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3.5 py-4 border-b border-border min-h-[64px]">
          <div className="w-8 h-8 bg-brand-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <Leaf className="size-4 text-white" />
          </div>
          <div className="sidebar-item-label opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
            <p className="text-sm font-bold text-brand-900 leading-none">
              AgriAI
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              Farm Intelligence
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto scrollbar-thin">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors duration-150 min-h-[36px]",
                      active
                        ? "bg-brand-50 text-brand-800 font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 flex-shrink-0" />
                    <span className="sidebar-item-label opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap">
                      {label}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="group-hover/sidebar:hidden"
                >
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-2.5 py-2 w-full rounded-lg text-sm text-muted-foreground hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
              >
                <LogOut className="size-4 flex-shrink-0" />
                <span className="sidebar-item-label opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap">
                  Sign out
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="group-hover/sidebar:hidden">
              Sign out
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

/* ── TopBar ───────────────────────────────────────────────────────── */
/**
 * Sticky top bar — standardised at exactly 64px height.
 * All content that needs to offset below this (e.g. sticky tab nav)
 * should use `top-16` (64px).
 */
export function TopBar({
  title,
  children,
  breadcrumb,
}: {
  title: string;
  children?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 h-16 border-b border-border bg-card sticky top-0 z-10 flex-shrink-0">
      <div className="flex flex-col justify-center min-w-0 mr-4">
        {breadcrumb && (
          <div className="text-[11px] text-muted-foreground mb-0.5">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-base font-semibold text-foreground truncate leading-tight">
          {title}
        </h1>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
      )}
    </div>
  );
}
