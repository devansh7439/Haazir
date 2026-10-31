import { Timer } from "lucide-react";
import { cx } from "@/components/ui";

const CALLOUT = {
  red: { box: "border-rose-200 bg-rose-50/70", icon: "bg-rose-100 text-rose-600", title: "text-rose-900" },
  amber: { box: "border-amber-200 bg-amber-50/70", icon: "bg-amber-100 text-amber-700", title: "text-amber-950" },
  violet: { box: "border-violet-200 bg-violet-50/70", icon: "bg-violet-100 text-violet-700", title: "text-violet-950" },
  brand: { box: "border-brand-200 bg-brand-50/60", icon: "bg-brand-100 text-brand-700", title: "text-brand-900" },
  green: { box: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-700", title: "text-emerald-950" },
};

export function Callout({ tone, icon: Icon, title, children, role }: { tone: keyof typeof CALLOUT; icon: typeof Timer; title: React.ReactNode; children?: React.ReactNode; role?: string }) {
  const t = CALLOUT[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-2xl border p-4", t.box)}>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", t.icon)}><Icon aria-hidden className="size-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm font-semibold", t.title)}>{title}</div>
        {children && <div className="mt-1 text-sm text-zinc-700">{children}</div>}
      </div>
    </div>
  );
}
