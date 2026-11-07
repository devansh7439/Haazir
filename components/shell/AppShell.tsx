"use client";

import { BadgeCheck, BarChart3, Building2, ListChecks, ListFilter, LogOut, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo, cx } from "@/components/ui";
import { REFERRAL_STATUS, mmss } from "@/lib/ui/display";

const NAV = [
  { href: "/", label: "New referral", icon: Plus, hint: "N", match: (p: string) => p === "/" },
  { href: "/queue", label: "Queue", icon: ListChecks, hint: null, match: (p: string) => p.startsWith("/queue") },
  { href: "/history", label: "Referrals", icon: ListFilter, hint: null, match: (p: string) => p.startsWith("/history") || p.startsWith("/referrals") },
  { href: "/facilities", label: "Hospitals", icon: Building2, hint: null, match: (p: string) => p.startsWith("/facilities") },
  { href: "/analytics", label: "Analytics", icon: BarChart3, hint: null, match: (p: string) => p.startsWith("/analytics") },
  { href: "/doctors", label: "Doctors", icon: BadgeCheck, hint: null, match: (p: string) => p.startsWith("/doctors") },
];

/** What the top bar names the page. */
const TITLES: Array<[(p: string) => boolean, string]> = [
  [(p) => p === "/", "New referral"],
  [(p) => p.startsWith("/queue"), "Queue"],
  [(p) => p.startsWith("/referrals"), "Referral"],
  [(p) => p.startsWith("/history"), "Referrals"],
  [(p) => p.startsWith("/facilities"), "Hospitals"],
  [(p) => p.startsWith("/analytics"), "Analytics"],
  [(p) => p.startsWith("/doctors"), "Doctors"],
];

interface ShellUser {
  name: string;
  facility: string | null;
  signOut: boolean;
  /** A coordinator has no registration of their own, so the Doctors page is not in their menu. */
  coordinator: boolean;
}

/** A referral still in progress, for the "Live now" list. */
export interface LiveReferral {
  id: string;
  code: string;
  case_label: string;
  status: string;
  ttfa_seconds: number | null;
  calls_total: number;
}

export interface ShellDrafts {
  count: number;
  firstId: string | null;
}

async function signOut() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

export function AppShell(props: {
  children: ReactNode;
  user: ShellUser | null;
  mode: "live" | "not_configured";
  live: LiveReferral[];
  drafts: ShellDrafts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = NAV.filter((n) => !(props.user?.coordinator && n.href === "/doctors"));

  // "N" starts a new referral from anywhere, unless a field has the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      e.preventDefault();
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (pathname === "/login" || pathname.startsWith("/hospital/")) return <main className="min-h-screen">{props.children}</main>;
  const initials = (props.user?.name ?? "Dr")
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const title = TITLES.find(([match]) => match(pathname))?.[1] ?? "Haazir";

  return (
    <div className="min-h-screen lg:pl-60 print:pl-0">
      {/* Sidebar (desktop): on the canvas itself, with the page floating beside it. */}
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-60 flex-col px-3 pb-3 pt-4 lg:flex print:hidden">
        <Link href="/" aria-label="Haazir home" className="mb-5 px-2.5">
          <Logo />
        </Link>
        <nav aria-label="Main" className="space-y-0.5">
          {nav.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition",
                  active ? "bg-zinc-200/70 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900",
                )}
              >
                <n.icon aria-hidden className={cx("size-4", active ? "text-zinc-900" : "text-zinc-500")} strokeWidth={2} />
                <span className="flex-1">{n.label}</span>
                {n.hint && <span className="kbd">{n.hint}</span>}
              </Link>
            );
          })}
        </nav>

        {props.live.length > 0 && (
          <section aria-label="Live now" className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <h2 className="px-2.5 pb-1.5 text-xs font-medium text-zinc-400">Live now</h2>
            <ul className="space-y-0.5">
              {props.live.map((r) => {
                const status = REFERRAL_STATUS[r.status];
                return (
                  <li key={r.id}>
                    <Link href={`/referrals/${r.id}`} className="flex gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-zinc-200/40">
                      <span aria-hidden className="relative mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500 live-dot" />
                      <span className="min-w-0 text-[13px] leading-snug">
                        <span className="block truncate text-zinc-800">{r.case_label}</span>
                        <span className="kbd-num block truncate font-mono text-[11px] text-zinc-400">
                          {r.code} · {r.ttfa_seconds !== null ? `yes in ${mmss(r.ttfa_seconds)}` : (status?.text ?? r.status)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mt-auto space-y-2 pt-4">
          <div
            className={cx(
              "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs",
              props.mode === "live" ? "border-zinc-300 text-zinc-600" : "border-amber-300 text-amber-800",
            )}
          >
            <span aria-hidden className={cx("size-1.5 rounded-full", props.mode === "live" ? "bg-emerald-500" : "bg-amber-500")} />
            {props.mode === "live" ? "Live calling" : "Calls not configured"}
          </div>
          {props.user && (
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700">{initials}</span>
              <div className="min-w-0 flex-1 text-[13px] leading-tight">
                <div className="truncate font-medium text-zinc-900">{props.user.name}</div>
                {props.user.facility && <div className="truncate text-xs text-zinc-500">{props.user.facility}</div>}
              </div>
              {props.user.signOut && (
                <button aria-label="Sign out" title="Sign out" className="btn btn-ghost min-h-8 px-2" onClick={signOut}>
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
            {props.mode === "live" ? "Live" : "Not configured"}
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
                className={cx("flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium", active ? "bg-zinc-100 text-zinc-900" : "text-zinc-600")}
              >
                <n.icon aria-hidden className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* The page: a white panel floating on the canvas, with its own top bar. */}
      <div className="lg:p-2 lg:pl-0 print:p-0">
        <div className="min-h-[calc(100vh-1rem)] bg-white lg:rounded-2xl lg:border lg:border-line lg:shadow-(--shadow-soft) print:min-h-0 print:border-0 print:shadow-none">
          <div className="hidden h-14 items-center justify-between border-b border-line px-6 lg:flex print:hidden">
            <span className="text-sm text-zinc-700">{title}</span>
            {props.drafts.count > 0 && (
              <Link
                href={props.drafts.firstId ? `/?draft=${props.drafts.firstId}` : "/"}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] text-zinc-700 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-zinc-50"
              >
                <MessageCircle aria-hidden className="size-3.5 text-zinc-500" />
                {props.drafts.count === 1 ? "1 draft from WhatsApp" : `${props.drafts.count} drafts from WhatsApp`}
              </Link>
            )}
          </div>
          <main className="mx-auto min-w-0 max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
