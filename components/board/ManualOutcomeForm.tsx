import { useState } from "react";
import { BED_LABEL } from "@/lib/ui/display";
import type { AttemptView } from "@/lib/modules/referral/view.type";
import type { Post } from "./types";

export function ManualOutcomeForm({ a, post, onDone }: { a: AttemptView; post: Post; onDone: () => void }) {
  const [outcome, setOutcome] = useState(a.outcome && a.outcome !== "unclear" ? a.outcome : "accepted");
  const [bed, setBed] = useState(a.bed_type ?? "icu_with_ventilator");
  const [ready, setReady] = useState(a.ready_in_minutes?.toString() ?? "");
  const [contact, setContact] = useState(a.contact_person ?? "");
  const [conditions, setConditions] = useState(a.conditions ?? "");
  const [reason, setReason] = useState(a.decline_reason ?? "");
  const accepted = outcome === "accepted" || outcome === "conditional";
  return (
    <form
      className="mt-3 grid gap-3 rounded-xl border border-line bg-zinc-50/70 p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await post(`/api/attempts/${a.id}/manual-outcome`, {
          outcome,
          bed_type: accepted ? bed : null,
          ready_in_minutes: ready ? Number(ready) : null,
          contact_person: contact || null,
          conditions: outcome === "conditional" ? conditions || null : null,
          decline_reason: outcome === "declined" ? reason || null : null,
        });
        if (res.ok) onDone();
      }}
    >
      <p className="text-sm font-medium text-zinc-900 sm:col-span-2">What did the desk tell you?</p>
      <div>
        <label className="label" htmlFor={`o-${a.id}`}>Outcome</label>
        <select id={`o-${a.id}`} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          <option value="accepted">Accepted</option>
          <option value="conditional">Accepted with a condition</option>
          <option value="declined">Declined</option>
          <option value="callback_later">Call back later</option>
          <option value="unclear">Unclear</option>
        </select>
      </div>
      {accepted && (
        <div>
          <label className="label" htmlFor={`b-${a.id}`}>Bed type</label>
          <select id={`b-${a.id}`} className="input" value={bed} onChange={(e) => setBed(e.target.value)}>
            {Object.entries(BED_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      {accepted && (
        <div>
          <label className="label" htmlFor={`r-${a.id}`}>Ready in (min)</label>
          <input id={`r-${a.id}`} className="input" inputMode="numeric" value={ready} onChange={(e) => setReady(e.target.value.replace(/\D/g, ""))} />
        </div>
      )}
      <div>
        <label className="label" htmlFor={`c-${a.id}`}>Contact person</label>
        <input id={`c-${a.id}`} className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      {outcome === "conditional" && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`k-${a.id}`}>Condition</label>
          <input id={`k-${a.id}`} className="input" value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </div>
      )}
      {outcome === "declined" && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`d-${a.id}`}>Reason</label>
          <input id={`d-${a.id}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary">Save outcome</button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
