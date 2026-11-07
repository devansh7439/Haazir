"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/components/facilities/api";

/** Sends a doctor's registration number and council for an admin to check. A changed number is checked again. */
export function RegistrationForm(props: { referrerId: string; number: string | null; council: string | null }) {
  const router = useRouter();
  const [number, setNumber] = useState(props.number ?? "");
  const [council, setCouncil] = useState(props.council ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = `reg-${props.referrerId}`;

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const err = await send("POST", `/api/referrers/${props.referrerId}/registration`, { registration_no: number, registration_council: council });
        setError(err);
        setSaving(false);
        if (!err) router.refresh();
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-no`} className="label mb-0">Registration number</label>
        <input id={`${id}-no`} className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="KMC/2011/04567" maxLength={40} required />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-council`} className="label mb-0">Council</label>
        <input id={`${id}-council`} className="input" value={council} onChange={(e) => setCouncil(e.target.value)} placeholder="NMC or your state council" maxLength={80} required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Sending…" : "Send for checking"}</button>
      {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-3">{error}</p>}
    </form>
  );
}
