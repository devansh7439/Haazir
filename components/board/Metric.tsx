import { Timer } from "lucide-react";
import { cx } from "@/components/ui";

export function Metric({ icon: Icon, label, value, highlight, className }: { icon: typeof Timer; label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={cx("px-4 first:pl-0 last:pr-0", className)}>
      <dt className="flex items-center gap-1 text-xs text-zinc-500"><Icon aria-hidden className="size-3.5" />{label}</dt>
      <dd className={cx("kbd-num text-2xl font-semibold leading-tight", highlight ? "text-emerald-600" : "text-zinc-900")}>{value}</dd>
    </div>
  );
}
