import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sends the referral and opens its board. The payload carries a client id, so a double-click or a retry after a network
 * error never calls the hospitals twice for the same patient (the server treats the id as idempotent).
 */
export function useReferralSubmit() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const send = async (payload: Record<string, unknown>): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error?.message ?? "Could not start the referral");
        setSubmitting(false);
        return;
      }
      router.push(`/referrals/${data.id}`);
    } catch {
      setSubmitError("Network error: check the connection and try again");
      setSubmitting(false);
    }
  };

  return { submitting, submitError, send };
}
