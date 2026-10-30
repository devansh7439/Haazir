"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabaseBrowser";
import {
  BED_LABEL, LANGUAGE_LABEL, REFERRAL_STATUS, TONE, attemptDisplay, clock, eventText, mmss, shortName, type Group,
} from "@/lib/ui";
import type { AttemptView, ReferralView } from "@/lib/view";
import type { MapPin } from "./BoardMap";

const BoardMap = dynamic(() => import("./BoardMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading map…</div>,
});

type Post = (url: string, body?: unknown) => Promise<{ ok: boolean; data: Record<string, unknown> }>;

const GROUP_TITLE: Record<Group, string> = {
  accepted: "Accepted",
  in_progress: "In progress",
  waiting: "Waiting",
  not_available: "Not available",
};
const GROUP_ORDER: Group[] = ["accepted", "in_progress", "waiting", "not_available"];

export function LiveBoard({ initial }: { initial: ReferralView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [announce, setAnnounce] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<AttemptView | null>(null);
  const r = view.referral;
  const id = r.id;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/referrals/${id}`, { cache: "no-store" });
    if (res.ok) setView(await res.json());
  }, [id]);

  const post: Post = useCallback(async (url, body) => {
    setActionError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setActionError((data as { error?: { message?: string } }).error?.message ?? "That didn't work");
    await refresh();
    return { ok: res.ok, data };
  }, [refresh]);

  // Clock for the header timer and "On call · 0:48".
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Tick: drives wave 2, callbacks, hold expiry and (when simulated) the scenario.
  const live = r.status !== "closed" && (r.status !== "cancelled" || view.attempts.some((a) => !["completed", "no_answer", "busy", "failed", "canceled"].includes(a.status)));
  useEffect(() => {
    if (!live) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      try {
        await fetch(`/api/referrals/${id}/tick`, { method: "POST" });
        await refresh();
      } catch {
        // Network blip: try again next tick.
      }
      if (!stop) timer = setTimeout(loop, view.tick_interval_ms);
    };
    timer = setTimeout(loop, 300);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, live, refresh, view.tick_interval_ms]);

  // Realtime: any change to this referral's rows triggers a refetch of the (redacted) view.
  useEffect(() => {
    const sb = browserSupabase();
    if (!sb) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void refresh();
      }, 150);
    };
    const channel = sb
      .channel(`referral:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_attempts", filter: `referral_id=eq.${id}` }, bump)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "referrals", filter: `id=eq.${id}` }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `referral_id=eq.${id}` }, bump)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    return () => {
      if (pending) clearTimeout(pending);
      void sb.removeChannel(channel);
    };
  }, [id, refresh]);

  const facilityName = useCallback(
    (fid: unknown) => shortName(view.attempts.find((a) => a.facility_id === fid)?.facility_name),
    [view.attempts],
  );

  // Latest availability attempt per hospital is its card; redials and callbacks replace earlier attempts.
  const cards = useMemo(() => {
    const latest = new Map<string, AttemptView>();
    const counts = new Map<string, number>();
    for (const a of view.attempts.filter((x) => x.purpose === "availability")) {
      const key = a.facility_id ?? a.id;
      latest.set(key, a);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...latest.entries()].map(([key, a]) => ({ a, calls: counts.get(key) ?? 1 }));
  }, [view.attempts]);

  // Screen-reader announcements: "Banyan accepted".
  const prev = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const next = new Map<string, string>();
    const said: string[] = [];
    for (const { a } of cards) {
      const text = attemptDisplay(a, Date.now()).text.replace(/ · \d+:\d+$/, "");
      next.set(a.facility_id ?? a.id, text);
      const before = prev.current.get(a.facility_id ?? a.id);
      if (before && before !== text) said.push(`${shortName(a.facility_name)}: ${text}`);
    }
    prev.current = next;
    if (said.length) setAnnounce(said.join(". "));
  }, [cards]);

  const elapsed = (nowMs - new Date(r.created_at).getTime()) / 1000;
  const endAt = r.closed_at ?? (r.status === "confirmed" ? r.confirmed_at : null);
  const timerSeconds = endAt ? (new Date(endAt).getTime() - new Date(r.created_at).getTime()) / 1000 : elapsed;
  const ttfa = r.first_acceptance_at ? (new Date(r.first_acceptance_at).getTime() - new Date(r.created_at).getTime()) / 1000 : null;
  const status = REFERRAL_STATUS[r.status] ?? { text: r.status, className: "bg-gray-100" };

  const pins: MapPin[] = cards
    .filter(({ a }) => a.facility_lat !== null && a.facility_lng !== null)
    .map(({ a }) => {
      const d = attemptDisplay(a, nowMs);
      const held = r.selected_facility_id === a.facility_id && r.status === "confirmed";
      return {
        id: a.id,
        lat: a.facility_lat!,
        lng: a.facility_lng!,
        label: String(a.rank ?? "•"),
        color: held ? TONE.held.pin : TONE[d.tone].pin,
        icon: held ? "🔒" : d.icon,
        title: shortName(a.facility_name),
        detail: `${a.eta_minutes ?? "?"} min · ${held ? "Bed held" : d.text}`,
      };
    });

  const grouped = GROUP_ORDER.map((g) => ({
    g,
    items: cards
      .filter(({ a }) => attemptDisplay(a, nowMs).group === g)
      .sort((x, y) => (x.a.eta_minutes ?? 999) - (y.a.eta_minutes ?? 999)),
  })).filter((x) => x.items.length > 0);

  const holdAttempts = view.attempts.filter((a) => a.purpose === "hold_confirm");
  const hold = holdAttempts[holdAttempts.length - 1] ?? null;
  const releases = view.attempts.filter((a) => a.purpose === "release");
  const holdExpired = view.events.some((e) => e.type === "hold_expired");
  const nextReferral = view.events.find((e) => e.type === "referral_closed" && (e.payload as { next_referral_id?: string }).next_referral_id);

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="sr-only">{announce}</div>

      {/* Header: code, case, timer, first yes, status */}
      <section className="card sticky top-0 z-[1000] sm:top-[52px] flex flex-wrap items-center gap-x-5 gap-y-2 p-3 sm:p-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">
            <span className="font-mono">{r.code}</span> · {view.case_label} · <span className="capitalize">{r.acuity}</span>
          </h1>
          <p className="text-sm text-slate-600">
            {view.referrer.name.replace(" (Demo)", "")}
            {view.referrer.facility_name ? `, ${shortName(view.referrer.facility_name)}` : ""} · needs {view.needs.map((n) => n.label).join(" + ") || "—"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase text-slate-500">Elapsed</div>
            <div className="font-mono text-3xl font-bold tabular-nums" aria-label={`Elapsed ${mmss(timerSeconds)}`}>⏱ {mmss(timerSeconds)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase text-slate-500">First yes</div>
            <div className="font-mono text-3xl font-bold tabular-nums text-green-800">{ttfa !== null ? mmss(ttfa) : "—"}</div>
          </div>
          <span className={`rounded-full px-3 py-1 font-bold ${status.className}`}>● {status.text}</span>
          {r.is_simulated && <span className="rounded bg-yellow-300 px-2 py-1 text-sm font-extrabold text-yellow-950">SIMULATED</span>}
        </div>
      </section>

      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 font-semibold text-red-800">{actionError}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="card h-40 overflow-hidden lg:sticky lg:top-[150px] lg:h-[560px]">
          <BoardMap origin={view.origin} pins={pins} />
        </div>

        <div className="space-y-4">
          {view.alerts.map((al) => (
            <AlertBanner key={al.event_id} alert={al} onDismiss={() => post(`/api/referrals/${id}/dismiss-alert`, { event_id: al.event_id })} />
          ))}

          {(r.status === "confirming" || r.status === "confirmed" || (r.status === "cancelled" && releases.length > 0)) && (
            <HoldPanel view={view} hold={hold} releases={releases} holdExpired={holdExpired} facilityName={facilityName} post={post} />
          )}

          {r.status === "exhausted" && (
            <ExhaustedPanel view={view} cards={cards.map((c) => c.a)} onWiden={async () => {
              const res = await post(`/api/referrals/${id}/widen`, { radius_km: 80 });
              if (res.ok) router.push(`/referrals/${res.data.id}`);
            }} />
          )}

          {nextReferral && (
            <p className="card p-3">
              Widened search continues in{" "}
              <Link className="font-semibold text-blue-800 underline" href={`/referrals/${(nextReferral.payload as { next_referral_id: string }).next_referral_id}`}>
                the new referral
              </Link>
              .
            </p>
          )}

          {grouped.map(({ g, items }) => (
            <section key={g} aria-labelledby={`g-${g}`}>
              <h2 id={`g-${g}`} className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{GROUP_TITLE[g]}</h2>
              <ul className="space-y-3">
                {items.map(({ a, calls }) => (
                  <AttemptCard
                    key={a.id}
                    a={a}
                    calls={calls}
                    nowMs={nowMs}
                    referralStatus={r.status}
                    isSelected={r.selected_attempt_id === a.id}
                    onSelect={() => setSelecting(a)}
                    post={post}
                  />
                ))}
              </ul>
            </section>
          ))}

          {["searching", "options_ready", "exhausted", "confirming"].includes(r.status) && (
            <div className="flex flex-wrap gap-2">
              <CancelButton onCancel={(reason) => post(`/api/referrals/${id}/cancel`, { reason })} />
            </div>
          )}
        </div>
      </div>

      <Timeline view={view} facilityName={facilityName} />

      {selecting && (
        <SelectDialog
          a={selecting}
          onClose={() => setSelecting(null)}
          onConfirmCall={async () => {
            await post(`/api/referrals/${id}/select`, { attempt_id: selecting.id, force: selecting.needs_review });
            setSelecting(null);
          }}
          onConfirmManual={async (contact) => {
            await post(`/api/referrals/${id}/confirm-manually`, { attempt_id: selecting.id, contact_person: contact || null });
            setSelecting(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function AlertBanner({ alert, onDismiss }: { alert: ReferralView["alerts"][number]; onDismiss: () => void }) {
  if (alert.type === "alert") {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 p-3">
        <p className="flex-1 font-semibold text-amber-950">⚠ {alert.reason ?? alert.kind}</p>
        <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
      </div>
    );
  }
  const who = alert.facility_name ?? "A hospital";
  return (
    <div role="alert" className="rounded-xl border-2 border-violet-600 bg-violet-50 p-4">
      <p className="text-lg font-bold text-violet-950">
        ☎ {who} {alert.type === "inbound_callback" ? "called back" : "wants to talk to you"}
        {alert.contact_person ? ` (${alert.contact_person})` : ""}
      </p>
      {alert.reason && <p className="mt-1 text-violet-950">“{alert.reason}”</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {alert.number && (
          <a className="btn btn-call flex-1 text-lg sm:flex-none" href={`tel:${alert.number}`}>☎ Call desk {alert.number}</a>
        )}
        <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
      </div>
      <p className="mt-2 text-sm text-violet-900">After the call, record what they said with “Record outcome” on their card.</p>
    </div>
  );
}

function AttemptCard(props: {
  a: AttemptView;
  calls: number;
  nowMs: number;
  referralStatus: string;
  isSelected: boolean;
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
  const terminal = ["completed", "no_answer", "busy", "failed", "canceled"].includes(a.status);
  const canRedial = terminal && !accepted && ["searching", "options_ready", "exhausted"].includes(props.referralStatus);

  return (
    <li className={`card border-l-8 p-3 sm:p-4 ${tone.card}`} style={{ borderLeftColor: tone.pin }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: tone.pin }} aria-hidden="true">
          {a.rank ?? "•"}
        </span>
        <h3 className="text-lg font-bold">{shortName(a.facility_name)}</h3>
        <span className="text-slate-600">· {a.eta_minutes ?? "?"} min · {a.distance_km ?? "?"} km · {LANGUAGE_LABEL[a.call_language] ?? a.call_language}</span>
        {props.isSelected && <span className="rounded bg-green-700 px-2 py-0.5 text-xs font-bold text-white">SELECTED</span>}
      </div>
      <p className={`mt-2 inline-flex items-center gap-2 rounded-md px-2 py-1 font-bold ${tone.badge}`}>
        <span aria-hidden="true">{d.icon}</span> {d.text}
      </p>

      {accepted && (
        <div className="mt-2 space-y-0.5">
          <p>
            {BED_LABEL[a.bed_type ?? "unknown"] ?? a.bed_type}
            {a.ready_in_minutes !== null ? ` · ready in ${a.ready_in_minutes} min` : ""}
            {a.specialist_available && a.specialist_available !== "unknown" ? ` · specialist ${a.specialist_available.replace("_", " ")}` : ""}
          </p>
          {a.contact_person && <p>Ask for <strong>{a.contact_person}</strong></p>}
          {a.conditions && <p className="font-semibold text-amber-900">Condition: {a.conditions}</p>}
        </div>
      )}
      {a.outcome === "needs_doctor" && a.conditions && <p className="mt-2">“{a.conditions}”{a.contact_person ? ` · ${a.contact_person}` : ""}</p>}
      {a.needs_review && (
        <p className="mt-2 font-semibold text-orange-900">
          The answer is unclear (call: {a.outcome ?? "none"}, transcript: {a.extraction_outcome ?? "none"}). Listen before selecting.
        </p>
      )}
      {a.contact_is_ivr && <p className="mt-1 text-sm text-amber-900">IVR line only: a direct desk number works better.</p>}

      <div className="mt-2 flex flex-wrap gap-1">
        {a.rank_reasons.map((reason) => (
          <span key={reason} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{reason}</span>
        ))}
        {props.calls > 1 && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{props.calls} calls</span>}
        {a.outcome_source && a.outcome_source !== "function" && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">from {a.outcome_source}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canSelect && !a.needs_review && (
          <button className="btn btn-primary flex-1 sm:flex-none" onClick={props.onSelect}>Select</button>
        )}
        {canSelect && a.needs_review && (
          <button className="btn btn-secondary" onClick={props.onSelect}>Select anyway (I listened)</button>
        )}
        <a className="btn btn-secondary flex-1 sm:flex-none" href={`tel:${a.to_number}`}>☎ Call desk</a>
        {a.recording_url && (
          <audio controls preload="none" src={a.recording_url} className="h-11 max-w-full">
            <a href={a.recording_url}>▶ Recording</a>
          </audio>
        )}
        {a.transcript && (
          <button className="btn btn-secondary" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>
            {showTranscript ? "Hide transcript" : "Transcript"}
          </button>
        )}
        <button className="btn btn-secondary" aria-expanded={showManual} onClick={() => setShowManual((s) => !s)}>
          {a.needs_review || a.outcome === "unclear" ? "Set outcome" : "Record outcome"}
        </button>
        {canRedial && (
          <button className="btn btn-secondary" onClick={() => props.post(`/api/attempts/${a.id}/redial`, { contact_id: a.contact_id ?? undefined, to_number: a.contact_id ? undefined : a.to_number })}>
            ↻ Redial
          </button>
        )}
      </div>
      {showTranscript && a.transcript && (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{a.transcript}</pre>
      )}
      {showManual && <ManualOutcomeForm a={a} post={props.post} onDone={() => setShowManual(false)} />}
    </li>
  );
}

function ManualOutcomeForm({ a, post, onDone }: { a: AttemptView; post: Post; onDone: () => void }) {
  const [outcome, setOutcome] = useState(a.outcome && a.outcome !== "unclear" ? a.outcome : "accepted");
  const [bed, setBed] = useState(a.bed_type ?? "icu_with_ventilator");
  const [ready, setReady] = useState(a.ready_in_minutes?.toString() ?? "");
  const [contact, setContact] = useState(a.contact_person ?? "");
  const [conditions, setConditions] = useState(a.conditions ?? "");
  const [reason, setReason] = useState(a.decline_reason ?? "");
  const accepted = outcome === "accepted" || outcome === "conditional";
  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
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
      <p className="text-sm text-slate-600 sm:col-span-2">What did the desk tell you on your call?</p>
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

function SelectDialog(props: { a: AttemptView; onClose: () => void; onConfirmCall: () => Promise<void>; onConfirmManual: (contact: string) => Promise<void> }) {
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
    <dialog ref={ref} onClose={props.onClose} aria-labelledby="sel-h" className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/50">
      <div className="space-y-4 p-5">
        <h2 id="sel-h" className="text-xl font-bold">Send the patient to {name} ({props.a.eta_minutes} min)?</h2>
        <p>Haazir will call {name} to confirm the bed, then send the pre-arrival note on WhatsApp and release the other hospitals.</p>
        {props.a.needs_review && <p className="font-semibold text-orange-900">Their answer was flagged as unclear. Only continue if you listened to the recording.</p>}
        {manual && (
          <div>
            <label className="label" htmlFor="sel-contact">Who confirmed? (optional)</label>
            <input id="sel-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {!manual ? (
            <>
              <button className="btn btn-primary flex-1" disabled={busy} onClick={async () => { setBusy(true); await props.onConfirmCall(); }}>
                Confirm &amp; call
              </button>
              <button className="btn btn-secondary flex-1" onClick={() => setManual(true)}>I already confirmed by phone</button>
            </>
          ) : (
            <button className="btn btn-primary flex-1" disabled={busy} onClick={async () => { setBusy(true); await props.onConfirmManual(contact); }}>
              Mark bed confirmed
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => ref.current?.close()}>Back</button>
        </div>
      </div>
    </dialog>
  );
}

function HoldPanel(props: {
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
  const msgStatus = (aud: string) => view.messages.find((m) => m.audience === aud);
  const [showPreviews, setShowPreviews] = useState(false);

  if (r.status === "confirming") {
    const d = hold ? attemptDisplay(hold, Date.now()) : null;
    return (
      <section className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4" aria-live="polite">
        <p className="text-lg font-bold">◐ Confirming the bed with {name}…</p>
        {d && <p className="mt-1">{d.icon} {d.text}</p>}
      </section>
    );
  }
  return (
    <section className="rounded-xl border-2 border-green-700 bg-green-50 p-4" aria-labelledby="hold-h">
      {r.status === "confirmed" && (
        <h2 id="hold-h" className="text-lg font-bold text-green-950">
          🔒 Bed held at {name} until {clock(r.hold_expires_at)}{contact ? ` · ask for ${contact}` : ""}
        </h2>
      )}
      {r.status === "cancelled" && <h2 id="hold-h" className="text-lg font-bold">Referral cancelled · releasing hospitals that accepted</h2>}
      {view.messages.length > 0 && (
        <p className="mt-2">
          WhatsApp:{" "}
          {(["receiving_facility", "family", "referrer"] as const).map((aud) => {
            const m = msgStatus(aud);
            if (!m) return null;
            const label = aud === "receiving_facility" ? "hospital" : aud === "referrer" ? "you" : "family";
            return (
              <span key={aud} className="mr-3">
                {label} {m.status === "failed" ? "✖" : "✓"} {m.status}
              </span>
            );
          })}
          <button className="text-sm font-semibold text-blue-800 underline" onClick={() => setShowPreviews((s) => !s)}>
            {showPreviews ? "hide previews" : "show previews"}
          </button>
          <span className="text-sm text-slate-600"> (previews are redacted)</span>
        </p>
      )}
      {showPreviews && (
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {view.messages.map((m) => (
            <pre key={m.audience + m.created_at} className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">
              <strong>{m.audience} · {m.to_masked || "no number"}</strong>{"\n"}{m.preview_redacted}
            </pre>
          ))}
        </div>
      )}
      {props.releases.length > 0 && (
        <p className="mt-2">
          Released:{" "}
          {props.releases.map((a) => (
            <span key={a.id} className="mr-3">
              {props.facilityName(a.facility_id)} {a.outcome === "release_ack" ? "✓" : ["no_answer", "busy", "failed"].includes(a.status) ? "⊘ no answer" : "◐ calling"}
            </span>
          ))}
        </p>
      )}
      {r.status === "confirmed" && (
        <div className="mt-3 space-y-2">
          {props.holdExpired && <p className="font-bold text-amber-900">Hold expired. Did the patient arrive?</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => props.post(`/api/referrals/${r.id}/close`, { reason: "arrived" })}>Patient arrived</button>
            {props.holdExpired && (
              <button className="btn btn-secondary" onClick={() => props.post(`/api/referrals/${r.id}/close`, { reason: "hold_expired" })}>Close</button>
            )}
            <CancelButton onCancel={(reason) => props.post(`/api/referrals/${r.id}/cancel`, { reason })} />
          </div>
        </div>
      )}
    </section>
  );
}

function ExhaustedPanel({ view, cards, onWiden }: { view: ReferralView; cards: AttemptView[]; onWiden: () => void }) {
  const calls = view.attempts.filter((a) => a.purpose === "availability").length;
  return (
    <section className="rounded-xl border-2 border-red-500 bg-red-50 p-4" aria-labelledby="ex-h">
      <h2 id="ex-h" className="text-lg font-bold text-red-950">
        No hospital accepted after {view.referral.current_wave} round{view.referral.current_wave === 1 ? "" : "s"} ({calls} calls). Call these desks directly:
      </h2>
      <ol className="mt-3 space-y-2">
        {[...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
            <span className="font-semibold">{a.rank}. {shortName(a.facility_name)}</span>
            <span className="text-sm text-slate-600">{a.eta_minutes} min · last answer: {attemptDisplay(a, Date.now()).text}</span>
            <a className="btn btn-call ml-auto" href={`tel:${a.to_number}`}>☎ {a.to_number}</a>
          </li>
        ))}
      </ol>
      <button className="btn btn-primary mt-3" onClick={onWiden}>Widen to 80 km and try again</button>
    </section>
  );
}

function CancelButton({ onCancel }: { onCancel: (reason: string) => void }) {
  return (
    <button
      className="btn btn-danger"
      onClick={() => {
        const reason = window.prompt("Cancel this referral? Reason (optional):", "patient stabilised");
        if (reason !== null) onCancel(reason);
      }}
    >
      Cancel referral
    </button>
  );
}

function Timeline({ view, facilityName }: { view: ReferralView; facilityName: (id: unknown) => string }) {
  const start = new Date(view.referral.created_at).getTime();
  const items = view.events
    .map((e) => ({ e, text: eventText({ type: e.type, payload: e.payload as Record<string, unknown> }, facilityName) }))
    .filter((x) => x.text);
  return (
    <section className="card p-4" aria-labelledby="tl-h">
      <h2 id="tl-h" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Timeline</h2>
      <ol className="space-y-1 text-sm">
        {items.map(({ e, text }) => (
          <li key={e.id} className="flex gap-3">
            <span className="w-14 shrink-0 font-mono tabular-nums text-slate-500">{mmss((new Date(e.created_at).getTime() - start) / 1000)}</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
