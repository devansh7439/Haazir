"use client";

import { ArrowLeft, Check, CheckCircle2, PhoneCall, RotateCw, Timer, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";
import { GROUP_TITLE, cardsOf, groupCards, holdState, isCancellable, nextReferralId, pinsOf, searchTimes, withoutTimer } from "@/lib/ui/board";
import { TONE, attemptDisplay, mmss, shortName } from "@/lib/ui/display";
import { ReferralStatusPill, SectionTitle, SimBadge, cx } from "@/components/ui";
import { AlertCallout } from "./AlertCallout";
import { AttemptCard } from "./AttemptCard";
import { Callout } from "./Callout";
import { CancelButton } from "./CancelButton";
import { ExhaustedPanel } from "./ExhaustedPanel";
import { HoldPanel } from "./HoldPanel";
import { Legend } from "./Legend";
import { Metric } from "./Metric";
import { SelectDialog } from "./SelectDialog";
import { Timeline } from "./Timeline";
import { useLiveReferral } from "./useLiveReferral";

const BoardMap = dynamic(() => import("./BoardMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-zinc-400">Loading map…</div>,
});

/** The live board for one referral: header timers, the map, a card per hospital, the hold panel and the timeline. */
export function LiveBoard({ initial }: { initial: ReferralView }) {
  const router = useRouter();
  const { view, nowMs, post, actionError } = useLiveReferral(initial);
  const [announce, setAnnounce] = useState("");
  const [selecting, setSelecting] = useState<AttemptView | null>(null);
  const r = view.referral;
  const id = r.id;

  const facilityName = useCallback((fid: unknown) => shortName(view.attempts.find((a) => a.facility_id === fid)?.facility_name), [view.attempts]);
  const cards = useMemo(() => cardsOf(view.attempts), [view.attempts]);
  const pins = useMemo(() => pinsOf(cards, r.selected_facility_id, r.status), [cards, r.selected_facility_id, r.status]);

  // Screen-reader announcements: "Banyan: Accepted".
  const prev = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const next = new Map<string, string>();
    const said: string[] = [];
    for (const { a } of cards) {
      const text = withoutTimer(attemptDisplay(a, Date.now()).text);
      next.set(a.facility_id ?? a.id, text);
      const before = prev.current.get(a.facility_id ?? a.id);
      if (before && before !== text) said.push(`${shortName(a.facility_name)}: ${text}`);
    }
    prev.current = next;
    if (said.length) setAnnounce(said.join(". "));
  }, [cards]);

  const { elapsed, ttfa } = searchTimes(r, view.events, nowMs);
  const displays = cards.map(({ a }) => attemptDisplay(a, nowMs));
  const acceptedCount = displays.filter((d) => d.group === "accepted").length;
  const onLine = displays.filter((d) => d.group === "in_progress").length;
  const grouped = groupCards(cards, nowMs);
  const { hold, releases, expired: holdExpired } = holdState(view);
  const nextId = nextReferralId(view.events);

  return (
    <div className="space-y-5">
      <div aria-live="polite" className="sr-only">{announce}</div>

      <Link href="/history" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft aria-hidden className="size-4" /> Referrals
      </Link>

      {/* Header: identity, live metrics, status. Sticky so the timer stays visible on phones. */}
      <section className="card z-[1000] -mt-2 sm:sticky sm:top-0 px-4 py-3.5 sm:px-5">
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
            <Metric icon={Timer} label="Elapsed" value={mmss(elapsed)} />
            <Metric icon={CheckCircle2} label="First yes" value={ttfa !== null ? mmss(ttfa) : "—"} highlight={ttfa !== null} />
            <Metric icon={PhoneCall} label="On the line" value={String(onLine)} className="hidden sm:block" />
            <Metric icon={Check} label="Accepted" value={`${acceptedCount}/${cards.length}`} className="hidden sm:block" />
          </dl>
          <div className="ml-auto flex items-center gap-2">
            <ReferralStatusPill status={r.status} />
            {isCancellable(r.status) && <CancelButton compact onCancel={(reason) => post(`/api/referrals/${id}/cancel`, { reason })} />}
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

          {nextId && (
            <Callout tone="brand" icon={RotateCw} title="The search continues in a new referral with a wider radius.">
              <Link className="font-medium text-brand-700 underline underline-offset-2" href={`/referrals/${nextId}`}>
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
