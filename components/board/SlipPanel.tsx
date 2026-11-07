"use client";

import { ClipboardCopy, FileText } from "lucide-react";
import { useState } from "react";
import { CONSENTS } from "@/components/referral-form/options";
import type { TransferConsent } from "@/lib/core/types";
import type { Slip } from "@/lib/modules/referral/slip.helper";

type SlipState = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; slip: Slip } | { kind: "error"; message: string };

/**
 * The transfer record: who agreed to the transfer, and the referral slip once a hospital has confirmed the bed. The slip
 * holds no patient name or phone, so it can be copied into the doctor's own case sheet.
 */
export function SlipPanel(props: { referralId: string; consent: TransferConsent | null }) {
  const [consent, setConsent] = useState<TransferConsent | null>(props.consent);
  const [saving, setSaving] = useState(false);
  const [slip, setSlip] = useState<SlipState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(value: TransferConsent) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${props.referralId}/transfer-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfer_consent: value }),
      });
      if (!res.ok) setError((await res.json())?.error?.message ?? "Could not record the consent");
      else {
        setConsent(value);
        // A slip already on screen would show the old consent.
        setSlip((s) => (s.kind === "ready" ? { kind: "idle" } : s));
      }
    } catch {
      setError("Network error: check the connection and try again");
    }
    setSaving(false);
  }

  async function load() {
    setSlip({ kind: "loading" });
    try {
      const res = await fetch(`/api/referrals/${props.referralId}/slip`);
      const data = await res.json();
      setSlip(res.ok ? { kind: "ready", slip: data.slip } : { kind: "error", message: data?.error?.message ?? "Could not load the slip" });
    } catch {
      setSlip({ kind: "error", message: "Network error: check the connection and try again" });
    }
  }

  async function copy(lines: string[]) {
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card mt-6 px-5 py-4" aria-labelledby="slip-h">
      <h2 id="slip-h" className="flex items-center gap-2 text-[15px] font-semibold">
        <FileText aria-hidden className="size-4" /> Transfer record
      </h2>
      <div role="radiogroup" aria-label="Consent to the transfer" className="seg mt-3">
        {CONSENTS.filter((c) => c.value !== "none").map((c) => (
          <label key={c.value} className={`seg-item${consent === c.value ? " seg-item-on" : ""}`}>
            <input type="radio" name="slip-consent" className="sr-only" checked={consent === c.value} disabled={saving} onChange={() => void record(c.value as TransferConsent)} />
            {c.label}
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">{consent ? "Consent recorded." : "Consent to the transfer is not recorded yet."}</p>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4">
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={slip.kind === "loading"}>
          {slip.kind === "ready" ? "Refresh slip" : "Show referral slip"}
        </button>
        {slip.kind === "error" && <p role="alert" className="mt-2 text-sm text-zinc-600">{slip.message}</p>}
        {slip.kind === "ready" && (
          <div className="mt-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed ring-1 ring-inset ring-line">{slip.slip.lines.join("\n")}</pre>
            <button type="button" className="btn btn-secondary mt-2" onClick={() => void copy(slip.slip.lines)}>
              <ClipboardCopy aria-hidden className="size-4" /> {copied ? "Copied" : "Copy slip"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
