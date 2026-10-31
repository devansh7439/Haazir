"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * A modal question with a clear way back. Replaces window.confirm and window.prompt: it can't be dismissed by a
 * stray keypress, the dangerous choice is labelled, and the button shows progress while the action runs.
 */
export function ConfirmDialog(props: {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      aria-labelledby="confirm-h"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line p-0 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <h2 id="confirm-h" className="text-lg font-semibold tracking-tight">{props.title}</h2>
        {props.description && <p className="mt-1.5 text-sm text-zinc-500">{props.description}</p>}
        {props.children && <div className="mt-4">{props.children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => ref.current?.close()}>
            {props.cancelLabel ?? "Back"}
          </button>
          <button
            type="button"
            className={cx("btn", props.danger ? "btn-danger-solid" : "btn-primary")}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await props.onConfirm();
              } finally {
                setBusy(false);
              }
              ref.current?.close();
            }}
          >
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
