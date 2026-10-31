import { BedDouble, Clock, FileText, MapPin, PenLine, Phone, RotateCw, TriangleAlert, User } from "lucide-react";
import { useState } from "react";
import { BED_LABEL, LANGUAGE_LABEL, TONE, attemptDisplay, clock, shortName } from "@/lib/ui/display";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";
import { callEnded } from "@/lib/ui/board";
import { StatusPill, cx } from "@/components/ui";
import { ManualOutcomeForm } from "./ManualOutcomeForm";
import type { Post } from "./types";

export function AttemptCard(props: {
  a: AttemptView;
  calls: number;
  nowMs: number;
  referralStatus: string;
  isSelected: boolean;
  portalFlag: ReferralView["portal_flags"][string] | null;
  onSelect: () => void;
  post: Post;
}) {
  const { a, nowMs } = props;
  const d = attemptDisplay(a, nowMs);
  const tone = TONE[d.tone];
  const [showManual, setShowManual] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const accepted = a.outcome === "accepted" || a.outcome === "conditional";
  const canSelect = accepted && ["options_ready", "searching", "exhausted"].includes(props.referralStatus);
  const terminal = callEnded(a.status);
  const canRedial = terminal && !accepted && ["searching", "options_ready", "exhausted"].includes(props.referralStatus);
  const muted = d.group === "not_available";
  // The drive time is already in the card header.
  const reasons = a.rank_reasons.filter((r) => !r.endsWith("min away"));

  return (
    <li className={cx("card relative overflow-hidden", props.isSelected && "ring-2 ring-green-600")}>
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[3px]", tone.accent)} />
      <div className="px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span
            aria-hidden
            className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white", d.tone === "amber" && "haazir-pin-live")}
            style={{ background: tone.pin }}
          >
            {a.rank ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* The hospital name is the most important text on the card: on phones it wraps instead of being cut off. */}
              <h3 className={cx("text-[15px] font-semibold sm:truncate", muted ? "text-zinc-600" : "text-zinc-900")}>{shortName(a.facility_name)}</h3>
              {props.isSelected && <span className="rounded-md bg-green-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">Selected</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1"><Clock aria-hidden className="size-3" />{a.eta_minutes ?? "?"} min</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3" />{a.distance_km ?? "?"} km</span>
              <span aria-hidden>·</span>
              <span>{LANGUAGE_LABEL[a.call_language] ?? a.call_language}</span>
              {props.calls > 1 && <><span aria-hidden>·</span><span>{props.calls} calls</span></>}
            </div>
          </div>
          {/* On phones the status gets its own line, lined up with the name, so it never squeezes the name. */}
          <div className="basis-full pl-11 sm:basis-auto sm:pl-0">
            <StatusPill tone={d.tone} text={d.text} icon={d.icon} />
          </div>
        </div>

        {accepted && (
          <div className="mt-3 grid gap-2 rounded-xl bg-zinc-50 p-3 text-sm sm:grid-cols-2">
            <span className="inline-flex items-center gap-2 text-zinc-800">
              <BedDouble aria-hidden className="size-4 text-zinc-400" />
              {BED_LABEL[a.bed_type ?? "unknown"] ?? a.bed_type}
              {a.ready_in_minutes !== null ? <span className="text-zinc-500">· ready in {a.ready_in_minutes} min</span> : null}
            </span>
            {a.contact_person && (
              <span className="inline-flex items-center gap-2 text-zinc-800"><User aria-hidden className="size-4 text-zinc-400" />Ask for <strong className="font-semibold">{a.contact_person}</strong></span>
            )}
            {a.conditions && (
              <span className="inline-flex items-start gap-2 text-amber-900 sm:col-span-2">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />Condition: {a.conditions}
              </span>
            )}
          </div>
        )}
        {a.outcome === "needs_doctor" && a.conditions && (
          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-950">“{a.conditions}”{a.contact_person ? ` · ${a.contact_person}` : ""}</p>
        )}
        {a.needs_review && (
          <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">
            The answer is unclear (call: {a.outcome ?? "none"}, transcript: {a.extraction_outcome ?? "none"}). Listen to the recording before selecting.
          </p>
        )}
        {props.portalFlag && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-inset ring-amber-200">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>Desk and portal disagree: {props.portalFlag.detail} at {clock(props.portalFlag.observed_at)} ({props.portalFlag.source}).</span>
          </p>
        )}
        {a.contact_is_ivr && <p className="mt-2 text-xs text-amber-800">Phone menu line only. A direct desk number works better.</p>}

        {!muted && reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {reasons.map((reason) => <span key={reason} className="tag">{reason}</span>)}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {canSelect && !a.needs_review && (
            <button className="btn btn-primary" onClick={props.onSelect}>Select hospital</button>
          )}
          {canSelect && a.needs_review && (
            <button className="btn btn-secondary" onClick={props.onSelect}>Select anyway</button>
          )}
          <a className="btn btn-secondary" href={`tel:${a.to_number}`}><Phone aria-hidden className="size-4" /> Call desk</a>
          {a.transcript && (
            <button className="btn btn-ghost" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>
              <FileText aria-hidden className="size-4" /> Transcript
            </button>
          )}
          <button className="btn btn-ghost" aria-expanded={showManual} onClick={() => setShowManual((s) => !s)}>
            <PenLine aria-hidden className="size-4" /> {a.needs_review || a.outcome === "unclear" ? "Set outcome" : "Record outcome"}
          </button>
          {canRedial && (
            <button className="btn btn-ghost" onClick={() => props.post(`/api/attempts/${a.id}/redial`, { contact_id: a.contact_id ?? undefined, to_number: a.contact_id ? undefined : a.to_number })}>
              <RotateCw aria-hidden className="size-4" /> Redial
            </button>
          )}
          {a.outcome_source && a.outcome_source !== "function" && (
            <span className="ml-auto text-xs text-zinc-400">via {a.outcome_source}</span>
          )}
        </div>
        {a.recording_url && (
          <audio controls preload="none" src={a.recording_url} className="mt-3 h-10 w-full">
            <a href={a.recording_url}>Recording</a>
          </audio>
        )}
        {showTranscript && a.transcript && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 font-sans text-[13px] leading-relaxed text-zinc-700 ring-1 ring-inset ring-line">{a.transcript}</pre>
        )}
        {showManual && <ManualOutcomeForm a={a} post={props.post} onDone={() => setShowManual(false)} />}
      </div>
    </li>
  );
}
