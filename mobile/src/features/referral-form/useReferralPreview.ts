import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { PreviewSchema, type Preview } from "../../api/schema";

/** Wait this long after the last change before asking for a preview. */
const DEBOUNCE_MS = 400;

/**
 * "What hospitals will hear": a debounced preview of the form with no side effects. A newer change cancels the
 * request in flight. Nothing is fetched until a case is picked.
 */
export function useReferralPreview(body: Record<string, unknown>, caseType: string) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(body);

  useEffect(() => {
    if (!caseType) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await api("/api/referrals/preview", PreviewSchema, { body: JSON.parse(key), signal: ctl.signal });
        setPreview(next);
        setError(null);
      } catch (err) {
        if (ctl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Preview failed");
      }
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [key, caseType]);

  // Nothing is shown until a case is picked, even if an earlier preview is still held.
  return { preview: caseType ? preview : null, error: caseType ? error : null, loading: caseType ? loading : false };
}
