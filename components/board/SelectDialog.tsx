import { BedDouble, PhoneCall } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortName } from "@/lib/ui/display";
import type { AttemptView } from "@/lib/modules/referral/view.type";

export function SelectDialog(props: { a: AttemptView; onClose: () => void; onConfirmCall: () => Promise<void>; onConfirmManual: (contact: string) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [contact, setContact] = useState(props.a.contact_person ?? "");
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const name = shortName(props.a.facility_name);
  return (
    <dialog ref={ref} onClose={props.onClose} aria-labelledby="sel-h" className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line p-0 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px]">
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50"><BedDouble aria-hidden className="size-5 text-brand-600" /></span>
          <div>
            <h2 id="sel-h" className="text-lg font-semibold tracking-tight">Send the patient to {name}?</h2>
            <p className="mt-1 text-sm text-zinc-500">About {props.a.eta_minutes} min away. Haazir calls the desk to confirm the bed, sends the pre-arrival note on WhatsApp and releases the other hospitals.</p>
          </div>
        </div>
        {props.a.needs_review && <p className="mt-4 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">Their answer was flagged as unclear. Only continue if you listened to the recording.</p>}
        {manual && (
          <div className="mt-4">
            <label className="label" htmlFor="sel-contact">Who confirmed? (optional)</label>
            <input id="sel-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-ghost" onClick={() => ref.current?.close()}>Back</button>
          {!manual ? (
            <>
              <button className="btn btn-secondary" onClick={() => setManual(true)}>I already confirmed by phone</button>
              <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await props.onConfirmCall(); }}>
                <PhoneCall aria-hidden className="size-4" /> Confirm &amp; call
              </button>
            </>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await props.onConfirmManual(contact); }}>
              Mark bed confirmed
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
