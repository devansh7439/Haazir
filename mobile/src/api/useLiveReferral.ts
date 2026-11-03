import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { isIdle, isLive } from "../lib/board";
import { z } from "zod";
import { ApiError, api } from "./client";
import { ReferralViewSchema, type ReferralView } from "./schema";

/** Tick interval once the bed is held and every call has finished: only the hold-expiry check is left. */
const IDLE_TICK_MS = 30_000;
/** The board re-reads this often between ticks, so a hospital's answer shows within a second. */
const FAST_POLL_MS = 1000;
const MIN_TICK_MS = 1000;

const AnyOk = z.unknown();

/** What an action returned: whether it worked, and the server's answer (the new referral's id after a widen). */
export interface ActResult {
  ok: boolean;
  data: unknown;
}

/**
 * Keeps one referral's board current. The server only advances a referral (second wave, callbacks, hold expiry,
 * missed webhooks) when something ticks it, so while the board is open it ticks and re-reads, and re-reads every
 * second in between. Polling stops while the app is in the background. `nowMs` is the server's clock, so the timers
 * are right even when the phone's clock is off. `act` runs an action, then re-reads; its error shows in `actionError`.
 */
export function useLiveReferral(id: string) {
  const [view, setView] = useState<ReferralView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const skewMs = useRef(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastRequest = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const sawAccepted = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    const seq = ++lastRequest.current;
    try {
      const next = await api(`/api/referrals/${id}`, ReferralViewSchema);
      if (seq !== lastRequest.current) return;
      skewMs.current = new Date(next.server_time).getTime() - Date.now();
      setView(next);
      setLoadError(null);
    } catch (err) {
      if (seq !== lastRequest.current) return;
      // A blip while the board is already showing is ignored; the next poll tries again.
      if (err instanceof ApiError && (err.status === 404 || err.code === "BAD_RESPONSE")) setLoadError(err.message);
      else setLoadError((prev) => prev ?? (err instanceof Error ? err.message : "Can't load the referral"));
    }
  }, [id]);

  const act = useCallback(
    async (path: string, body?: unknown): Promise<ActResult> => {
      setActionError(null);
      try {
        const data = await api(path, AnyOk, { method: "POST", body: body ?? {} });
        await refresh();
        return { ok: true, data };
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "That didn't work");
        await refresh();
        return { ok: false, data: null };
      }
    },
    [refresh],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now() + skewMs.current), 1000);
    return () => clearInterval(t);
  }, []);

  const live = view ? isLive(view) : true;
  const idle = view ? isIdle(view) : false;
  const tickMs = view ? Math.max(MIN_TICK_MS, view.tick_interval_ms) : MIN_TICK_MS;

  // Tick the server, then re-read.
  useEffect(() => {
    if (!live || !foreground) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (view) await api(`/api/referrals/${id}/tick`, AnyOk, { method: "POST", body: {} }).catch(() => {});
      await refresh();
      if (!stop) timer = setTimeout(loop, idle ? IDLE_TICK_MS : tickMs);
    };
    timer = setTimeout(loop, view ? 300 : 0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // `view` is read only to skip the first tick before there is a view; it must not restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, live, idle, foreground, refresh, tickMs, view === null]);

  // Between ticks, re-read every second while calls are in flight.
  useEffect(() => {
    if (!live || idle || !foreground || view === null) return;
    const t = setInterval(() => void refresh(), FAST_POLL_MS);
    return () => clearInterval(t);
  }, [live, idle, foreground, refresh, view === null]);

  // One buzz when the first hospital says yes while the screen is open.
  const accepted = view ? view.referral.first_acceptance_at !== null : null;
  useEffect(() => {
    if (accepted === null) return;
    if (sawAccepted.current === false && accepted) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    sawAccepted.current = accepted;
  }, [accepted]);

  return { view, nowMs, act, actionError, loadError, refresh };
}
