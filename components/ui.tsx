import {
  Ban, Check, CircleDashed, CircleHelp, CornerUpRight, Lock, Phone, PhoneCall, RotateCw, X, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { REFERRAL_STATUS, TONE, type IconKey, type Tone } from "@/lib/ui";

// Small shared primitives. Server- and client-safe (no hooks).

export const STATUS_ICON: Record<IconKey, LucideIcon> = {
  queued: CircleDashed,
  ringing: PhoneCall,
  oncall: Phone,
  check: Check,
  x: X,
  phone: Phone,
  callback: RotateCw,
  redirect: CornerUpRight,
  ban: Ban,
  help: CircleHelp,
  lock: Lock,
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Status pill: dot or icon + text, never colour alone. */
export function StatusPill({ tone, text, icon, live, size = "md" }: { tone: Tone; text: string; icon?: IconKey; live?: boolean; size?: "sm" | "md" }) {
  const t = TONE[tone];
  const Icon = icon ? STATUS_ICON[icon] : null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]",
        t.badge,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.25} />
      ) : (
        <span aria-hidden className={cx("relative size-1.5 rounded-full", t.dot, live && "live-dot")} />
      )}
      {text}
    </span>
  );
}

export function ReferralStatusPill({ status, size }: { status: string; size?: "sm" | "md" }) {
  const s = REFERRAL_STATUS[status] ?? { text: status, tone: "grey" as Tone };
  return <StatusPill tone={s.tone} text={s.text} live={s.live} size={size} />;
}

export function SimBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-inset ring-amber-300">
      Simulated
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: "brand" | "green" }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div
        className={cx(
          "kbd-num mt-1 text-2xl font-semibold",
          accent === "green" ? "text-emerald-600" : accent === "brand" ? "text-brand-700" : "text-zinc-900",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-zinc-900">{children}</h2>
      {count !== undefined && <span className="rounded-full bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600">{count}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_2px_8px_rgba(99,56,239,0.35)]">
        <svg viewBox="0 0 24 24" className="size-[18px] text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
          <path d="M4 12h3l2-5 3 10 2.5-7 1.5 2H20" />
        </svg>
      </span>
      {!compact && <span className="text-[17px] font-semibold tracking-tight text-zinc-900">Haazir</span>}
    </span>
  );
}
