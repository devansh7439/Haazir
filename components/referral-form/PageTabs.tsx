import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import type { Page } from "./steps";

/** The two pages of the full form as tabs. "Patient" opens only once the case page is complete. */
export function PageTabs({ page, caseMissing, onGo }: { page: Page; caseMissing: string | null; onGo: (next: Page) => void }) {
  return (
    <nav aria-label="Referral pages" className="mb-8 flex items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => onGo("case")}
        aria-current={page === "case" ? "step" : undefined}
        className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition", page === "case" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
      >
        <span aria-hidden className={cx("grid size-5 place-items-center rounded-full text-[11px]", page === "case" ? "bg-white/20" : "bg-zinc-900 text-white")}>
          {page === "patient" && !caseMissing ? <Check className="size-3" strokeWidth={3} /> : 1}
        </span>
        Case
      </button>
      <span aria-hidden className="h-px w-6 bg-zinc-300" />
      <button
        type="button"
        onClick={() => onGo("patient")}
        disabled={!!caseMissing}
        aria-current={page === "patient" ? "step" : undefined}
        className={cx(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed disabled:text-zinc-400",
          page === "patient" ? "bg-zinc-900 text-white" : "text-zinc-600 enabled:hover:bg-zinc-100",
        )}
      >
        <span aria-hidden className={cx("grid size-5 place-items-center rounded-full text-[11px]", page === "patient" ? "bg-white/20" : "border border-zinc-300")}>2</span>
        Patient
      </button>
    </nav>
  );
}
