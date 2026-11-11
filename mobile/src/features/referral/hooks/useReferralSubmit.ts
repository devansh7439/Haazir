import { useState } from 'react';
import { ReferralRepository } from '../../../api/referral.repository';
import { t } from '../../../lib/i18n';

type CreateBody = Parameters<typeof ReferralRepository.create>[0];

/**
 * Sends the referral and reports the id it got. The request id inside `body` is reused on a retry, so a double tap or a
 * network error never calls the hospitals twice. A failure leaves the form as it was, with the reason in `submitError`.
 */
export function useReferralSubmit(onCreated: (id: string) => void) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function send(body: CreateBody) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await ReferralRepository.create(body);
      onCreated(created.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('Could not start the referral'));
      setSubmitting(false);
    }
  }

  return { submitting, submitError, send };
}
