import { Check } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Records that the patient arrived, after asking: it closes the referral, and a closed referral can't be reopened. */
export function ArrivedButton({ onArrived }: { onArrived: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Check aria-hidden className="size-4" /> Patient arrived
      </button>
      {open && (
        <ConfirmDialog
          title="Has the patient arrived?"
          description="This closes the referral. It can't be reopened."
          confirmLabel="Yes, patient arrived"
          cancelLabel="Not yet"
          onConfirm={async () => void (await onArrived())}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
