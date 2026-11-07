"use client";

import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { clock } from "@/lib/ui/display";

/** One tap when the receiving hospital begins treating the patient. It feeds "median time to treatment" on Analytics. */
export function TreatmentPanel(props: { referralId: string; startedAt: string | null }) {
  const [startedAt, setStartedAt] = useState<string | null>(props.startedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${props.referralId}/treatment-started`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setStartedAt(data.treatment_started_at);
      else setError(data?.error?.message ?? "Could not record it");
    } catch {
      setError("Network error: check the connection and try again");
    }
    setSaving(false);
  }

  return (
    <section className="card mt-6 flex flex-wrap items-center gap-3 px-5 py-4" aria-labelledby="treat-h">
      <h2 id="treat-h" className="flex items-center gap-2 text-[15px] font-semibold">
        <Stethoscope aria-hidden className="size-4" /> Treatment
      </h2>
      {startedAt ? (
        <span className="text-sm text-zinc-600">Started at {clock(startedAt)}</span>
      ) : (
        <button type="button" className="btn btn-secondary ml-auto" disabled={saving} onClick={() => void record()}>
          Treatment has started
        </button>
      )}
      {error && <p role="alert" className="w-full text-sm text-rose-700">{error}</p>}
    </section>
  );
}
