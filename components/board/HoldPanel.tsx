import { Check, Lock, Mail, MessageCircle, PhoneCall } from "lucide-react";
import { useState } from "react";
import { LANGUAGE_LABEL, attemptDisplay, clock, shortName } from "@/lib/ui/display";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";
import { StatusPill } from "@/components/ui";
import { Callout } from "./Callout";
import { CancelButton } from "./CancelButton";
import type { Post } from "./types";

export function HoldPanel(props: {
  view: ReferralView;
  hold: AttemptView | null;
  releases: AttemptView[];
  holdExpired: boolean;
  facilityName: (id: unknown) => string;
  post: Post;
}) {
  const { view, hold } = props;
  const r = view.referral;
  const selected = view.attempts.find((a) => a.id === r.selected_attempt_id);
  const name = shortName(selected?.facility_name ?? hold?.facility_name);
  const contact = hold?.contact_person || selected?.contact_person;
  const [showPreviews, setShowPreviews] = useState(false);

  if (r.status === "confirming") {
    const d = hold ? attemptDisplay(hold, Date.now()) : null;
    return (
      <Callout tone="amber" icon={PhoneCall} title={`Confirming the bed with ${name}`}>
        {d ? `${d.text}. The desk is being asked to keep the bed ready.` : "Placing the confirmation call…"}
      </Callout>
    );
  }

  const MSG: Array<{ aud: string; label: string }> = [
    { aud: "receiving_facility", label: "Pre-arrival note to hospital" },
    { aud: "referrer", label: "Confirmation to you" },
    { aud: "family", label: "Family update" },
  ];

  return (
    <section className="card overflow-hidden" aria-labelledby="hold-h">
      {r.status === "confirmed" ? (
        <div className="flex items-start gap-3 bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 py-4 text-white">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Lock aria-hidden className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="hold-h" className="text-[15px] font-semibold">Bed held at {name}</h2>
            <p className="mt-0.5 text-sm text-emerald-50">
              Until {clock(r.hold_expires_at)}{contact ? ` · ask for ${contact}` : ""}{selected?.eta_minutes ? ` · ${selected.eta_minutes} min away` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="border-b border-line px-5 py-4">
          <h2 id="hold-h" className="text-[15px] font-semibold">Referral cancelled · releasing hospitals that said yes</h2>
        </div>
      )}

      <div className="divide-y divide-line">
        {view.messages.length > 0 && (
          <div className="px-5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">WhatsApp handoff</span>
              <button className="text-xs font-medium text-brand-700 hover:text-brand-800" onClick={() => setShowPreviews((s) => !s)}>
                {showPreviews ? "Hide previews" : "Show redacted previews"}
              </button>
            </div>
            <ul className="space-y-1.5">
              {MSG.map(({ aud, label }) => {
                const m = view.messages.find((x) => x.audience === aud);
                if (!m) return null;
                return (
                  <li key={aud} className="flex items-center gap-2 text-sm">
                    <MessageCircle aria-hidden className="size-4 text-zinc-400" />
                    <span className="flex-1 text-zinc-800">{label}</span>
                    <span className="kbd-num text-xs text-zinc-400">{m.to_masked || "no number"}</span>
                    <StatusPill size="sm" tone={m.status === "failed" ? "red" : m.status === "simulated" ? "grey" : "green"} text={m.status} icon={m.status === "failed" ? "x" : "check"} />
                  </li>
                );
              })}
            </ul>
            {showPreviews && (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {view.messages.map((m) => (
                  <div key={m.audience + m.created_at} className="rounded-xl bg-zinc-100 p-2">
                    <pre className="whitespace-pre-wrap rounded-lg rounded-tl-none bg-white p-2.5 font-sans text-xs leading-relaxed text-zinc-800 shadow-sm">{m.preview_redacted}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view.attempts.some((a) => a.purpose === "family_update") && (
          <div className="px-5 py-3">
            <div className="eyebrow mb-2">Family</div>
            <ul className="space-y-1.5">
              {view.attempts.filter((a) => a.purpose === "family_update").map((a) => {
                const done = a.outcome === "family_informed";
                const failed = ["no_answer", "busy", "failed"].includes(a.status);
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <PhoneCall aria-hidden className="size-4 text-zinc-400" />
                    <span className="flex-1 text-zinc-800">Update call to the family <span className="text-zinc-400">({LANGUAGE_LABEL[a.call_language] ?? a.call_language})</span></span>
                    <StatusPill size="sm" tone={done ? "green" : failed ? "dark" : "amber"} text={done ? "Informed" : failed ? "No answer" : "Calling"} icon={done ? "check" : failed ? "ban" : "oncall"} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {props.releases.length > 0 && (
          <div className="px-5 py-3">
            <div className="eyebrow mb-2">Released</div>
            <ul className="space-y-1.5">
              {props.releases.map((a) => {
                const done = a.outcome === "release_ack";
                const failed = ["no_answer", "busy", "failed"].includes(a.status);
                return (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <Mail aria-hidden className="size-4 text-zinc-400" />
                    <span className="flex-1 text-zinc-800">{props.facilityName(a.facility_id)}</span>
                    <StatusPill size="sm" tone={done ? "green" : failed ? "dark" : "amber"} text={done ? "Released" : failed ? "No answer" : "Calling"} icon={done ? "check" : failed ? "ban" : "oncall"} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {r.status === "confirmed" && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            {props.holdExpired && <span className="mr-auto text-sm font-medium text-amber-800">Hold expired. Did the patient arrive?</span>}
            <button className="btn btn-primary" onClick={() => props.post(`/api/referrals/${r.id}/close`, { reason: "arrived" })}>
              <Check aria-hidden className="size-4" /> Patient arrived
            </button>
            {props.holdExpired && (
              <button className="btn btn-secondary" onClick={() => props.post(`/api/referrals/${r.id}/close`, { reason: "hold_expired" })}>Close</button>
            )}
            <CancelButton onCancel={(reason) => props.post(`/api/referrals/${r.id}/cancel`, { reason })} />
          </div>
        )}
      </div>
    </section>
  );
}
