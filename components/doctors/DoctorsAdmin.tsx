"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, StatusPill } from "@/components/ui";
import { send } from "@/components/facilities/api";
import { RegistrationForm } from "./RegistrationForm";
import { VERIFICATION, type DoctorRow } from "./status";

/**
 * Admin: every referring doctor with their registration. "Verified" means an admin looked the number up in the NMC Indian
 * Medical Register or the state council's; Haazir does not look it up itself.
 */
export function DoctorsAdmin({ initial }: { initial: DoctorRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, decision: "verified" | "rejected") {
    setError(await send("POST", `/api/referrers/${id}/verification`, { decision }));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader title="Doctors" description="Check each doctor's medical registration against the NMC or state council register, then verify them." />
      {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {initial.map((d) => {
          const v = VERIFICATION[d.verification_status] ?? VERIFICATION.unverified;
          return (
            <li key={d.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-zinc-900">{d.name}</span>
                <StatusPill tone={v.tone} text={v.text} size="sm" icon={d.verification_status === "verified" ? "check" : d.verification_status === "rejected" ? "x" : "help"} />
                <span className="kbd-num text-sm text-zinc-600">{d.registration_no ? `${d.registration_council} ${d.registration_no}` : "No number given"}</span>
                <span className="ml-auto flex gap-2">
                  <button className="btn btn-primary min-h-8 px-3 text-xs" disabled={!d.registration_no || d.verification_status === "verified"} onClick={() => decide(d.id, "verified")}>
                    Verify
                  </button>
                  <button className="btn btn-secondary min-h-8 px-3 text-xs" disabled={!d.registration_no || d.verification_status === "rejected"} onClick={() => decide(d.id, "rejected")}>
                    Reject
                  </button>
                </span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-zinc-500">{d.registration_no ? "Change the number" : "Enter a number for this doctor"}</summary>
                <div className="mt-3">
                  <RegistrationForm referrerId={d.id} number={d.registration_no} council={d.registration_council} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
