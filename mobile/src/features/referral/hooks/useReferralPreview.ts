import { useEffect, useState } from 'react';
import { ReferralRepository, type ReferralBody } from '../../../api/referral.repository';
import type { Preview } from '../../../api/schema';
import { t } from '../../../lib/i18n';

/** Wait this long after the last change before asking for a preview. */
const DEBOUNCE_MS = 400;

/**
 * "What hospitals will hear": a debounced preview of the form with no side effects. A newer change cancels the
 * request in flight. Nothing is fetched until a case is picked.
 */
export function useReferralPreview(body: ReferralBody, caseType: string) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(body);

  useEffect(() => {
    if (!caseType) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = await ReferralRepository.preview(JSON.parse(key), controller.signal);
        setPreview(next);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t('Preview failed'));
      }
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, caseType]);

  // Nothing is shown until a case is picked, even if an earlier preview is still held.
  return { preview: caseType ? preview : null, error: caseType ? error : null, loading: caseType ? loading : false };
}
