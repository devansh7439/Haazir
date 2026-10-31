import { useCallback, useEffect, useRef, useState } from "react";
import { authorizeRealtime, browserSupabase } from "@/lib/integrations/supabase/supabase.browser";
import type { ReferralView } from "@/lib/modules/referral/view.type";
import { isIdle, isLive } from "@/lib/ui/board";
import type { Post } from "./types";

/** How often the board re-reads its view when Realtime isn't connected. */
const FAST_POLL_MS = 1000;
/** Tick interval once the bed is held and every call has finished: only the hold-expiry check is left. */
const IDLE_TICK_MS = 30_000;
/** Realtime tokens last an hour; they are renewed before that. */
const REAUTH_MS = 50 * 60_000;

/**
 * Keeps one referral's view current: ticks the server (wave 2, callbacks, hold expiry, the simulator), re-reads on
 * every Realtime change, and polls every second until Realtime connects. `nowMs` is the server's clock, ticking each
 * second. `post` runs a console action, then re-reads; its error is shown in `actionError`.
 */
export function useLiveReferral(initial: ReferralView) {
  const [view, setView] = useState(initial);
  // Server-minus-browser clock offset, so the timer is right even when the phone's clock is off.
  // A ref, not state: updating it on every refresh must not restart the 1 s timer.
  const skewMs = useRef(new Date(initial.server_time).getTime() - Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now() + skewMs.current);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeOn, setRealtimeOn] = useState(false);
  const id = view.referral.id;

  // Tick, Realtime and actions all re-read; only the newest request may update the view, so a slow older response can't roll it back.
  const lastRequest = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++lastRequest.current;
    const res = await fetch(`/api/referrals/${id}`, { cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as ReferralView;
      if (seq !== lastRequest.current) return;
      skewMs.current = new Date(next.server_time).getTime() - Date.now();
      setView(next);
    }
  }, [id]);

  const post: Post = useCallback(async (url, body) => {
    setActionError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    const error = data.error && typeof data.error === "object" ? (data.error as { message?: unknown }).message : undefined;
    if (!res.ok) setActionError(typeof error === "string" ? error : "That didn't work");
    await refresh();
    return { ok: res.ok, data };
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now() + skewMs.current), 1000);
    return () => clearInterval(t);
  }, []);

  const live = isLive(view);
  const idle = isIdle(view);
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
      if (!stop) timer = setTimeout(loop, idle ? IDLE_TICK_MS : view.tick_interval_ms);
    };
    timer = setTimeout(loop, 300);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, live, idle, refresh, view.tick_interval_ms]);

  // Without Realtime the board would only see changes on the next tick (up to 5 s; the spec asks for 2 s).
  useEffect(() => {
    if (!live || idle || realtimeOn) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    }, FAST_POLL_MS);
    return () => clearInterval(t);
  }, [live, idle, realtimeOn, refresh]);

  // Realtime: any change to this referral's rows triggers a re-read of the (redacted) view.
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
    const reauth = setInterval(() => void authorizeRealtime(sb), REAUTH_MS);
    void authorizeRealtime(sb).then((ok) => {
      if (!ok || cancelled) return;
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "call_attempts", filter: `referral_id=eq.${id}` }, bump)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "referrals", filter: `id=eq.${id}` }, bump)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `referral_id=eq.${id}` }, bump)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refresh();
          // Fall back to fast polling whenever the channel isn't delivering.
          setRealtimeOn(status === "SUBSCRIBED");
        });
    });
    return () => {
      cancelled = true;
      setRealtimeOn(false);
      clearInterval(reauth);
      if (pending) clearTimeout(pending);
      void sb.removeChannel(channel);
    };
  }, [id, refresh]);

  return { view, nowMs, post, actionError };
}
