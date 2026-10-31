import { Phone, PhoneCall, TriangleAlert } from "lucide-react";
import type { ReferralView } from "@/lib/modules/referral/view.type";
import { Callout } from "./Callout";

export function AlertCallout({ alert, onDismiss }: { alert: ReferralView["alerts"][number]; onDismiss: () => void }) {
  if (alert.type === "alert") {
    return (
      <Callout role="alert" tone="amber" icon={TriangleAlert} title={alert.reason ?? alert.kind}>
        <button className="btn btn-ghost -ml-2 mt-1 min-h-8 px-2 text-xs" onClick={onDismiss}>Dismiss</button>
      </Callout>
    );
  }
  const who = alert.facility_name ?? "A hospital";
  return (
    <Callout
      role="alert"
      tone="violet"
      icon={PhoneCall}
      title={<>{who} {alert.type === "inbound_callback" ? "called back" : "wants to talk to you"}{alert.contact_person ? <span className="font-normal text-violet-800"> · {alert.contact_person}</span> : null}</>}
    >
      {alert.reason && <p className="text-zinc-700">“{alert.reason}”</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {alert.number && (
          <a className="btn btn-success" href={`tel:${alert.number}`}><Phone aria-hidden className="size-4" /> Call desk · {alert.number}</a>
        )}
        <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
      </div>
    </Callout>
  );
}
