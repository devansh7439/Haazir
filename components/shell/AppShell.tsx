"use client";

import { BarChart3, Building2, FlaskConical, History, LogOut, PlusCircle, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo, cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "New referral", icon: PlusCircle, match: (p: string) => p === "/" || p.startsWith("/referrals") },
  { href: "/history", label: "Referrals", icon: History, match: (p: string) => p.startsWith("/history") },
  { href: "/facilities", label: "Hospitals", icon: Building2, match: (p: string) => p.startsWith("/facilities") },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { href: "/demo", label: "Demo console", icon: FlaskConical, match: (p: string) => p.startsWith("/demo") },
];

interface ShellUser {
  name: string;
  facility: string | null;
  signOut: boolean;
  showDemo: boolean;
}

async function signOut() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
}

export function AppShell(props: { children: ReactNode; user: ShellUser | null; mode: "live" | "simulation" }) {
  const pathname = usePathname();
  if (pathname === "/login") return <main className="min-h-screen">{props.children}</main>;
  const nav = NAV.filter((n) => n.href !== "/demo" || props.user?.showDemo);
  const initials = (props.user?.name ?? "Dr")
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className="min-h-screen lg:pl-64 print:pl-0">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-64 flex-col border-r border-line bg-white lg:flex print:hidden">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="Haazir home"><Logo /></Link>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  active ? "bg-brand-50 text-brand-800" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                )}
              >
                <n.icon aria-hidden className={cx("size-[18px]", active ? "text-brand-600" : "text-zinc-400")} strokeWidth={2} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-line p-4">
          <div
            className={cx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              props.mode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900",
            )}
          >
            <Radio aria-hidden className="size-3.5" />
            {props.mode === "live" ? "Live calling enabled" : "Simulation mode"}
          </div>
          {props.user && (
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">{initials}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium text-zinc-900">{props.user.name}</div>
                {props.user.facility && <div className="truncate text-xs text-zinc-500">{props.user.facility}</div>}
              </div>
              {props.user.signOut && (
                <button aria-label="Sign out" title="Sign out" className="btn btn-ghost min-h-9 px-2" onClick={signOut}>
                  <LogOut aria-hidden className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Top bar (mobile and tablet) */}
      <header className="border-b border-line bg-white lg:hidden print:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" aria-label="Haazir home"><Logo /></Link>
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", props.mode === "live" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
            {props.mode === "live" ? "Live" : "Simulation"}
          </span>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                  active ? "bg-brand-50 text-brand-800" : "text-zinc-600",
                )}
              >
                <n.icon aria-hidden className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto min-w-0 max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{props.children}</main>
    </div>
  );
}
