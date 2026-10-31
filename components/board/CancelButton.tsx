import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cx } from "@/components/ui";

const REASONS = ["Patient stabilised", "Taken elsewhere", "Sent by mistake", "Other"];

/** Cancels the referral after asking why; the reason is stored with the referral. */
export function CancelButton({ onCancel, compact }: { onCancel: (reason: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <>
      <button className={cx("btn", compact ? "btn-ghost text-zinc-500" : "btn-danger")} onClick={() => setOpen(true)}>
        Cancel{compact ? "" : " referral"}
      </button>
      {open && (
        <ConfirmDialog
          title="Cancel this referral?"
          description="Hospitals that are still being called will be released."
          confirmLabel="Cancel referral"
          cancelLabel="Keep it"
          danger
          onConfirm={() => onCancel(reason)}
          onClose={() => setOpen(false)}
        >
          <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} className={cx("chip", reason === r ? "chip-on" : "chip-off")} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
