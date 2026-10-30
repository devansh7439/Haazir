"use client";

import {
  ArrowLeft, BedDouble, Check, CheckCircle2, ChevronDown, Clock, FileText, Lock, Mail, MapPin, MessageCircle, PenLine, Phone,
  PhoneCall, RotateCw, Timer, TriangleAlert, User, X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authorizeRealtime, browserSupabase } from "@/lib/supabaseBrowser";
import { BED_LABEL, LANGUAGE_LABEL, TONE, attemptDisplay, clock, eventText, mmss, shortName, type Group } from "@/lib/ui";
import type { AttemptView, ReferralView } from "@/lib/view";
import type { MapPin as Pin } from "./BoardMap";
import { ReferralStatusPill, SectionTitle, SimBadge, StatusPill, cx } from "./ui";

const BoardMap = dynamic(() => import("./BoardMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-zinc-400">Loading map…</div>,
});

type Post = (url: string, body?: unknown) => Promise<{ ok: boolean; data: Record<string, unknown> }>;

const GROUP_TITLE: Record<Group, string> = {
  accepted: "Accepted",
  in_progress: "On the line",
  waiting: "Waiting",
  not_available: "Not available",
};
const GROUP_ORDER: Group[] = ["accepted", "in_progress", "waiting", "not_available"];
const TERMINAL = ["completed", "no_answer", "busy", "failed", "canceled"];

export function LiveBoard({ initial }: { initial: ReferralView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  // Server-minus-browser clock offset, so the timer is right even when the phone's clock is off.
  const [skewMs, setSkewMs] = useState(() => new Date(initial.server_time).getTime() - Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now() + skewMs);
  const [announce, setAnnounce] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<AttemptView | null>(null);
  const r = view.referral;
  const id = r.id;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/referrals/${id}`, { cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as ReferralView;
      setSkewMs(new Date(next.server_time).getTime() - Date.now());
      setView(next);
    }
  }, [id]);

  const post: Post = useCallback(async (url, body) => {
    setActionError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setActionError((data as { error?: { message?: string } }).error?.message ?? "That didn't work");
    await refresh();
    return { ok: res.ok, data };
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now() + skewMs), 1000);
    return () => clearInterval(t);
  }, [skewMs]);

  // Tick: drives wave 2, callbacks, hold expiry and (when simulated) the scenario.
  const live = r.status !== "closed" && (r.status !== "cancelled" || view.attempts.some((a) => !TERMINAL.includes(a.status)));
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
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void refresh();
      }, 150);
    };
    const channel = sb.channel(`referral:${id}`);
    // Re-authorise before the hour-long token expires.
    const reauth = setInterval(() => void authorizeRealtime(sb), 50 * 60_000);
    void authorizeRealtime(sb).then((ok) => {
      if (!ok || cancelled) return;
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "call_attempts", filter: `referral_id=eq.${id}` }, bump)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "referrals", filter: `id=eq.${id}` }, bump)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `referral_id=eq.${id}` }, bump)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refresh();
        });
    });
    return () => {
      cancelled = true;
      clearInterval(reauth);
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

  // Screen-reader announcements: "Banyan: Accepted".
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
  // The timer stops when the search ends: bed confirmed, closed, cancelled or nobody accepted.
  const endEvent = view.events.find((e) => e.type === "referral_cancelled" || e.type === "referral_exhausted");
  const endAt = r.confirmed_at ?? r.closed_at ?? (["cancelled", "exhausted"].includes(r.status) ? endEvent?.created_at ?? null : null);
  const timerSeconds = endAt ? (new Date(endAt).getTime() - new Date(r.created_at).getTime()) / 1000 : elapsed;
  const ttfa = r.first_acceptance_at ? (new Date(r.first_acceptance_at).getTime() - new Date(r.created_at).getTime()) / 1000 : null;

  const displays = cards.map(({ a }) => attemptDisplay(a, nowMs));
  const acceptedCount = displays.filter((d) => d.group === "accepted").length;
  const onLine = displays.filter((d) => d.group === "in_progress").length;

  const pins: Pin[] = cards
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
        live: d.tone === "amber",
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
  const cancellable = ["searching", "options_ready", "exhausted", "confirming"].includes(r.status);

  return (
    <div className="space-y-5">
      <div aria-live="polite" className="sr-only">{announce}</div>

      <Link href="/history" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft aria-hidden className="size-4" /> Referrals
      </Link>

      {/* Header: identity, live metrics, status. Sticky so the timer stays visible on phones. */}
      <section className="card sticky top-0 z-[1000] -mt-2 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="w-full min-w-0 xl:w-auto xl:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                <span className="kbd-num text-zinc-500">{r.code}</span>
                <span className="mx-2 text-zinc-300">/</span>
                {view.case_label}
              </h1>
              <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-semibold capitalize", r.acuity === "critical" ? "bg-rose-50 text-rose-700" : r.acuity === "serious" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>
                {r.acuity}
              </span>
              {r.is_simulated && <SimBadge />}
            </div>
            <p className="mt-0.5 text-sm text-zinc-500 sm:truncate">
              {view.referrer.name.replace(" (Demo)", "")}
              {view.referrer.facility_name ? ` · ${shortName(view.referrer.facility_name)}` : ""} · needs {view.needs.map((n) => n.label).join(", ") || "—"}
            </p>
          </div>
          <dl className="flex items-center divide-x divide-line">
            <Metric icon={Timer} label="Elapsed" value={mmss(timerSeconds)} />
            <Metric icon={CheckCircle2} label="First yes" value={ttfa !== null ? mmss(ttfa) : "—"} highlight={ttfa !== null} />
            <Metric icon={PhoneCall} label="On the line" value={String(onLine)} className="hidden sm:block" />
            <Metric icon={Check} label="Accepted" value={`${acceptedCount}/${cards.length}`} className="hidden sm:block" />
          </dl>
          <div className="ml-auto flex items-center gap-2">
            <ReferralStatusPill status={r.status} />
            {cancellable && <CancelButton compact onCancel={(reason) => post(`/api/referrals/${id}/cancel`, { reason })} />}
          </div>
        </div>
      </section>

      {actionError && <Callout tone="red" icon={TriangleAlert} title={actionError} />}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="card overflow-hidden lg:sticky lg:top-28">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold">Live map</h2>
            <div className="flex items-center gap-2.5 text-xs text-zinc-500 sm:gap-3">
              <Legend color={TONE.green.pin} label="Yes" />
              <Legend color={TONE.amber.pin} label="On call" />
              <Legend color={TONE.red.pin} label="No" />
            </div>
          </div>
          <div className="h-48 sm:h-64 lg:h-[520px]">
            <BoardMap origin={view.origin} pins={pins} />
          </div>
        </section>

        <div className="min-w-0 space-y-5">
          {/* Once the referral is cancelled or closed, call-back prompts are noise; they stay in the activity feed. */}
          {view.alerts.filter((al) => !["cancelled", "closed"].includes(r.status) || al.type === "alert").map((al) => (
            <AlertCallout key={al.event_id} alert={al} onDismiss={() => post(`/api/referrals/${id}/dismiss-alert`, { event_id: al.event_id })} />
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
            <Callout tone="brand" icon={RotateCw} title="The search continues in a new referral with a wider radius.">
              <Link className="font-medium text-brand-700 underline underline-offset-2" href={`/referrals/${(nextReferral.payload as { next_referral_id: string }).next_referral_id}`}>
                Open the new referral
              </Link>
            </Callout>
          )}

          {grouped.map(({ g, items }) => (
            <section key={g} aria-labelledby={`g-${g}`}>
              <SectionTitle count={items.length}><span id={`g-${g}`}>{GROUP_TITLE[g]}</span></SectionTitle>
              <ul className="space-y-2.5">
                {items.map(({ a, calls }) => (
                  <AttemptCard
                    key={a.id}
                    a={a}
                    calls={calls}
                    nowMs={nowMs}
                    referralStatus={r.status}
                    isSelected={r.selected_attempt_id === a.id}
                    portalFlag={view.portal_flags[a.id] ?? null}
                    onSelect={() => setSelecting(a)}
                    post={post}
                  />
                ))}
              </ul>
            </section>
          ))}
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

function Metric({ icon: Icon, label, value, highlight, className }: { icon: typeof Timer; label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={cx("px-4 first:pl-0 last:pr-0", className)}>
      <dt className="flex items-center gap-1 text-xs text-zinc-500"><Icon aria-hidden className="size-3.5" />{label}</dt>
      <dd className={cx("kbd-num text-2xl font-semibold leading-tight", highlight ? "text-emerald-600" : "text-zinc-900")}>{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

const CALLOUT = {
  red: { box: "border-rose-200 bg-rose-50/70", icon: "bg-rose-100 text-rose-600", title: "text-rose-900" },
  amber: { box: "border-amber-200 bg-amber-50/70", icon: "bg-amber-100 text-amber-700", title: "text-amber-950" },
  violet: { box: "border-violet-200 bg-violet-50/70", icon: "bg-violet-100 text-violet-700", title: "text-violet-950" },
  brand: { box: "border-brand-200 bg-brand-50/60", icon: "bg-brand-100 text-brand-700", title: "text-brand-900" },
  green: { box: "border-emerald-200 bg-emerald-50/60", icon: "bg-emerald-100 text-emerald-700", title: "text-emerald-950" },
};

function Callout({ tone, icon: Icon, title, children, role }: { tone: keyof typeof CALLOUT; icon: typeof Timer; title: React.ReactNode; children?: React.ReactNode; role?: string }) {
  const t = CALLOUT[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-2xl border p-4", t.box)}>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", t.icon)}><Icon aria-hidden className="size-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm font-semibold", t.title)}>{title}</div>
        {children && <div className="mt-1 text-sm text-zinc-700">{children}</div>}
      </div>
    </div>
  );
}

function AlertCallout({ alert, onDismiss }: { alert: ReferralView["alerts"][number]; onDismiss: () => void }) {
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
      <p className="mt-2 text-xs text-zinc-500">After the call, use “Record outcome” on their card.</p>
    </Callout>
  );
}

function AttemptCard(props: {
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
  const terminal = TERMINAL.includes(a.status);
  const canRedial = terminal && !accepted && ["searching", "options_ready", "exhausted"].includes(props.referralStatus);
  const muted = d.group === "not_available";

  return (
    <li className={cx("card relative overflow-hidden", props.isSelected && "ring-2 ring-emerald-500")}>
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[3px]", tone.accent)} />
      <div className="px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cx("grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white", d.tone === "amber" && "haazir-pin-live")}
            style={{ background: tone.pin }}
          >
            {a.rank ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={cx("truncate text-[15px] font-semibold", muted ? "text-zinc-600" : "text-zinc-900")}>{shortName(a.facility_name)}</h3>
              {props.isSelected && <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Selected</span>}
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
          <StatusPill tone={d.tone} text={d.text} icon={d.icon} />
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

        {!muted && a.rank_reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {a.rank_reasons.map((reason) => <span key={reason} className="tag">{reason}</span>)}
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
                  <div key={m.audience + m.created_at} className="rounded-xl bg-[#efeae2] p-2">
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

function ExhaustedPanel({ view, cards, onWiden }: { view: ReferralView; cards: AttemptView[]; onWiden: () => void }) {
  const calls = view.attempts.filter((a) => a.purpose === "availability").length;
  return (
    <section className="card overflow-hidden" aria-labelledby="ex-h">
      <div className="flex items-start gap-3 border-b border-line bg-rose-50/60 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600"><X aria-hidden className="size-5" /></span>
        <div>
          <h2 id="ex-h" className="text-[15px] font-semibold text-rose-950">
            No hospital accepted after {view.referral.current_wave} round{view.referral.current_wave === 1 ? "" : "s"} ({calls} calls)
          </h2>
          <p className="mt-0.5 text-sm text-rose-900/80">Call these desks directly, or widen the search.</p>
        </div>
      </div>
      <ol className="divide-y divide-line">
        {[...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="grid size-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{a.rank}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{shortName(a.facility_name)}</div>
              <div className="text-xs text-zinc-500">{a.eta_minutes} min · last answer: {attemptDisplay(a, Date.now()).text}</div>
            </div>
            <a className="btn btn-secondary" href={`tel:${a.to_number}`}><Phone aria-hidden className="size-4" /> {a.to_number}</a>
          </li>
        ))}
      </ol>
      <div className="border-t border-line px-5 py-3">
        <button className="btn btn-primary" onClick={onWiden}><RotateCw aria-hidden className="size-4" /> Widen to 80 km and try again</button>
      </div>
    </section>
  );
}

function CancelButton({ onCancel, compact }: { onCancel: (reason: string) => void; compact?: boolean }) {
  return (
    <button
      className={cx("btn", compact ? "btn-ghost text-zinc-500" : "btn-danger")}
      onClick={() => {
        const reason = window.prompt("Cancel this referral? Reason (optional):", "patient stabilised");
        if (reason !== null) onCancel(reason);
      }}
    >
      Cancel{compact ? "" : " referral"}
    </button>
  );
}

function Timeline({ view, facilityName }: { view: ReferralView; facilityName: (id: unknown) => string }) {
  const [expanded, setExpanded] = useState(false);
  const start = new Date(view.referral.created_at).getTime();
  const items = view.events
    .map((e) => ({ e, text: eventText({ type: e.type, payload: e.payload as Record<string, unknown> }, facilityName) }))
    .filter((x) => x.text);
  const shown = expanded ? items : items.slice(-12);
  const dot = (type: string) =>
    type === "options_ready" || type === "hold_confirmed" ? "bg-emerald-500"
      : type === "outcome_recorded" ? "bg-brand-500"
        : type === "alert" || type === "needs_review" ? "bg-amber-500"
          : type === "doctor_callback_requested" || type === "inbound_callback" ? "bg-violet-500"
            : "bg-zinc-300";
  return (
    <section className="card overflow-hidden" aria-labelledby="tl-h">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="tl-h" className="text-sm font-semibold">Activity</h2>
        <span className="text-xs text-zinc-500">Every event is timestamped for audit</span>
      </div>
      <ol className="relative px-5 py-4">
        <span aria-hidden className="absolute bottom-6 left-[5.35rem] top-6 w-px bg-line" />
        {shown.map(({ e, text }) => (
          <li key={e.id} className="relative flex items-start gap-4 py-1.5 text-sm">
            <span className="kbd-num w-12 shrink-0 pt-px text-right text-xs text-zinc-400">{mmss((new Date(e.created_at).getTime() - start) / 1000)}</span>
            <span aria-hidden className={cx("relative z-10 mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-white", dot(e.type))} />
            <span className="text-zinc-700">{text}</span>
          </li>
        ))}
      </ol>
      {items.length > 12 && (
        <button className="flex w-full items-center justify-center gap-1 border-t border-line py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Show latest only" : `Show all ${items.length} events`}
          <ChevronDown aria-hidden className={cx("size-4 transition", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
