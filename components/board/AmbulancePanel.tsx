"use client";

import { Ambulance, Phone } from "lucide-react";
import { useState } from "react";
import type { AmbulanceStatus } from "@/lib/core/types";

const STEPS: Array<{ value: AmbulanceStatus; label: string }> = [
  { value: "requested", label: "Requested" },
  { value: "dispatched", label: "On the way" },
  { value: "at_patient", label: "With the patient" },
  { value: "not_available", label: "None available" },
];

/**
 * Where the ambulance is. Haazir does not book it: call 108 (or the hospital's own ambulance) and tap the state here,
 * so a colleague taking over and the referral slip show it.
 */
export function AmbulancePanel(props: { referralId: string; status: AmbulanceStatus }) {
  const [status, setStatus] = useState<AmbulanceStatus>(props.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(next: AmbulanceStatus) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${props.referralId}/ambulance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) setStatus(next);
      else setError((await res.json())?.error?.message ?? "Could not record the ambulance");
    } catch {
      setError("Network error: check the connection and try again");
    }
    setSaving(false);
  }

  return (
    <section className="card mt-6 px-5 py-4" aria-labelledby="amb-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="amb-h" className="flex items-center gap-2 text-[15px] font-semibold">
          <Ambulance aria-hidden className="size-4" /> Ambulance
        </h2>
        <a href="tel:108" className="btn btn-secondary min-h-8 px-3 text-xs">
          <Phone aria-hidden className="size-3.5" /> Call 108
        </a>
      </div>
      <div role="radiogroup" aria-label="Ambulance status" className="seg mt-3">
        {STEPS.map((s) => (
          <label key={s.value} className={`seg-item${status === s.value ? " seg-item-on" : ""}`}>
            <input type="radio" name="ambulance" className="sr-only" checked={status === s.value} disabled={saving} onChange={() => void record(s.value)} />
            {s.label}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        {status === "not_requested" ? "Not recorded yet. Haazir doesn't book the ambulance; call 108, then tap the state here." : "Recorded by you."}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
