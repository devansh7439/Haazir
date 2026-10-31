import { cx } from "@/components/ui";

export function CancelButton({ onCancel, compact }: { onCancel: (reason: string) => void; compact?: boolean }) {
  return (
    <button
      className={cx("btn", compact ? "btn-ghost text-zinc-500" : "btn-danger")}
      onClick={() => {
        const reason = window.prompt("Cancel this referral? Reason (optional):", "patient stabilised");
        if (reason !== null) onCancel(reason);
      }}
    >
      Cancel{compact ? "" : " referral"}
    </button>
  );
}
