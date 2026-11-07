import { Check } from "lucide-react";
import { cx } from "@/components/ui";

/**
 * One numbered step of the form. The circle holds the step's number, or a tick once it is done, and a thin line runs down
 * to the next step.
 */
export function FormSection(props: { step: number; title: React.ReactNode; hint?: string; done?: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={typeof props.title === "string" ? props.title : undefined} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cx(
            "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium transition",
            props.done ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-500",
          )}
        >
          {props.done ? <Check className="size-3.5" strokeWidth={3} /> : props.step}
        </span>
        {!props.last && <span aria-hidden className="mt-1.5 w-px flex-1 bg-zinc-200" />}
      </div>
      <div className={cx("min-w-0", !props.last && "pb-9")}>
        <h2 className="flex min-h-6 items-center text-[15px] font-medium text-zinc-900">{props.title}</h2>
        {props.hint && <p className="mt-0.5 text-[13px] text-zinc-500">{props.hint}</p>}
        <div className="mt-3 grid gap-4">{props.children}</div>
      </div>
    </section>
  );
}
