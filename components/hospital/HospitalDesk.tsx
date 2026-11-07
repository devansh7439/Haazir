"use client";

import { Ban, CheckCircle2, Clock, PhoneCall, ShieldAlert, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo, cx } from "@/components/ui";
import type { DeskReferral, DeskSnapshot, DeskState } from "@/lib/modules/hospital/hospital.type";
import { clock } from "@/lib/ui/display";

const POLL_MS = 10_000;

const STATE_TEXT: Record<DeskState, string> = {
  asking: "We are calling your desk now",
  said_yes: "You said yes. Waiting for the doctor to choose",
  chosen: "Chosen. Confirming the bed with you",
  held: "Bed held",
  released: "Released: the patient was placed elsewhere or the search stopped",
  said_no: "You said no",
  other: "No answer was recorded",
};

/** The hospital's own screen, opened from a private link: what Haazir asked, "we're full", and "we can no longer take this patient". */
export function HospitalDesk({ token, initial, fullHours }: { token: string; initial: DeskSnapshot; fullHours: number }) {
  const [snap, setSnap] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/hospital/${token}`;

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(base, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setSnap(await res.json());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [base]);

  async function act(path: string, body: unknown) {
    setError(null);
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res) return setError("No connection. Try again.");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSnap(data);
    else setError(data?.error?.message ?? "That didn't work");
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <span className="text-xs text-zinc-500">Hospital desk</span>
      </header>
      <h1 className="text-xl font-semibold">{snap.facility_name}</h1>
      <p className="mt-1 text-sm text-zinc-600">Emergency referrals Haazir asked your desk about in the last 12 hours. No patient names are shown here.</p>

      {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-600">{error}</p>}

      <section className="card mt-5 p-5" aria-labelledby="cap-h">
        <h2 id="cap-h" className="text-sm font-semibold">Can you take emergency referrals?</h2>
        {snap.full_until ? (
          <>
            <p className="mt-2 flex items-center gap-2 text-sm text-amber-800"><Clock aria-hidden className="size-4" /> Marked full until {clock(snap.full_until)}. Haazir will not ask your desk about new patients until then.</p>
            <button className="btn btn-primary mt-3" onClick={() => act("/full", { full: false })}><CheckCircle2 aria-hidden className="size-4" /> We have space again</button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-600">Taking referrals. If you are full, tell Haazir so it stops calling your desk.</p>
            <button className="btn btn-secondary mt-3" onClick={() => act("/full", { full: true, hours: fullHours })}><Ban aria-hidden className="size-4" /> We&apos;re full for {fullHours} hours</button>
          </>
        )}
      </section>

      <section className="mt-6" aria-labelledby="ref-h">
        <h2 id="ref-h" className="mb-2 text-sm font-semibold">Recent referrals</h2>
        {snap.referrals.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet. Referrals appear here when Haazir calls your desk.</p>
        ) : (
          <ul className="space-y-3">
            {snap.referrals.map((r) => (
              <Row key={`${r.code}-${r.asked_at}`} r={r} onWithdraw={() => act("/withdraw", { code: r.code })} onTreatment={() => act("/treatment", { code: r.code })} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ r, onWithdraw, onTreatment }: { r: DeskReferral; onWithdraw: () => void; onTreatment: () => void }) {
  const live = r.state === "asking" || r.state === "chosen" || r.state === "held";
  return (
    <li className={cx("card p-4", !live && "opacity-80")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="kbd-num font-mono text-sm font-semibold">{r.code}</span>
        <span className="text-xs text-zinc-500">asked {clock(r.asked_at)}{r.eta_minutes !== null ? ` · about ${r.eta_minutes} min away` : ""}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-800">{r.summary}</p>
      {(r.doctor || r.referring_facility) && (
        <p className="mt-1 text-xs text-zinc-500">From {[r.doctor, r.referring_facility].filter(Boolean).join(", ")}</p>
      )}
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        <PhoneCall aria-hidden className="size-4 text-zinc-500" />
        {STATE_TEXT[r.state]}{r.hold_until ? ` until ${clock(r.hold_until)}` : ""}
      </p>
      {r.treatment_started_at && (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><Stethoscope aria-hidden className="size-4" /> Treatment started at {clock(r.treatment_started_at)}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {r.state === "held" && !r.treatment_started_at && (
          <button className="btn btn-primary" onClick={onTreatment}><Stethoscope aria-hidden className="size-4" /> Patient arrived and treatment has started</button>
        )}
        {r.can_withdraw && !r.treatment_started_at && (
          <button className="btn btn-secondary" onClick={onWithdraw}><ShieldAlert aria-hidden className="size-4" /> We can no longer take this patient</button>
        )}
      </div>
    </li>
  );
}
