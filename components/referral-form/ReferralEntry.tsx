"use client";

import { useState, type ComponentProps } from "react";
import { ReferralForm } from "./ReferralForm";

export interface ReferrerOption {
  id: string;
  name: string;
  facility: string | null;
}

type FormProps = ComponentProps<typeof ReferralForm>;

/**
 * For a coordinator or admin placing a referral for a doctor: choose who is referring, then the form. The form is not shown
 * until a doctor is chosen, so a referral never goes out under a doctor by default. The server records who keyed it in.
 */
export function ReferralEntry({ referrers, initialId, ...form }: Omit<FormProps, "referrerId"> & { referrers: ReferrerOption[]; initialId: string }) {
  const [referrerId, setReferrerId] = useState(initialId);
  return (
    <div>
      <div className="card-soft mx-auto mb-6 max-w-[780px] px-5 py-4">
        <label className="label" htmlFor="requested-by">Referring doctor</label>
        {/* A coordinator starts every referral here, so the keyboard lands on the choice that has no default. */}
        <select id="requested-by" className="input" value={referrerId} autoFocus={initialId === ""} onChange={(e) => setReferrerId(e.target.value)}>
          {referrerId === "" && <option value="">Choose the doctor this is for</option>}
          {referrers.map((r) => (
            <option key={r.id} value={r.id}>{r.facility ? `${r.name} · ${r.facility}` : r.name}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-zinc-500">
          Desks hear this doctor&apos;s name and are told to ask for them, and callbacks go to their phone. You are recorded as keying it in.
        </p>
      </div>
      {referrerId !== "" && <ReferralForm {...form} referrerId={referrerId} />}
    </div>
  );
}
