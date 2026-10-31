import { useEffect, useState } from "react";
import type { Preview } from "./types";

/** Wait this long after the last change before asking for a preview. */
const DEBOUNCE_MS = 400;

/**
 * "What hospitals will hear": a debounced preview of the form, with no side effects. A newer change cancels the
 * request in flight. Nothing is fetched until a case is picked.
 */
export function useReferralPreview(body: Record<string, unknown>, caseType: string) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseType) {
      setPreview(null);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/referrals/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message ?? "Preview failed");
        } else {
          setError(null);
          setPreview(data);
        }
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Preview failed");
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [body, caseType]);

  return { preview, error, loading };
}
