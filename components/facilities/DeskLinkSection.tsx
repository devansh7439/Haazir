"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { clock } from "@/lib/ui/display";

/** Admin: the hospital's private desk-screen link. The address is shown once; making a new one replaces the old. */
export function DeskLinkSection({ facilityId, fullUntil }: { facilityId: string; fullUntil: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = fullUntil && new Date(fullUntil) > new Date() ? fullUntil : null;

  async function make() {
    if (!window.confirm("Make a new link? Any link already given to this hospital stops working.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/facilities/${facilityId}/desk-link`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok) setUrl(data.url);
    else setError(data?.error?.message ?? "Couldn't make the link");
  }

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Hospital desk screen</h3>
      <p className="mb-3 text-xs text-zinc-500">
        A private link the hospital opens without signing in: it shows the referrals asked of its desk, and lets it mark itself full or say it can no longer take a patient.
        Send it only to the hospital&apos;s desk.
      </p>
      {full && <p className="mb-3 text-xs font-medium text-amber-800">Marked full until {clock(full)}. New searches skip this hospital.</p>}
      {url && (
        <div className="mb-3 rounded-xl bg-zinc-50 p-3">
          <p className="mb-1 text-xs text-zinc-500">Copy it now; it won&apos;t be shown again.</p>
          <input readOnly className="input kbd-num text-xs" value={url} aria-label="Desk screen link" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      {error && <p role="alert" className="mb-2 text-sm font-medium text-rose-600">{error}</p>}
      <button className="btn btn-secondary" onClick={make} disabled={busy}><Link2 aria-hidden className="size-4" /> {url ? "Make another link" : "Make a link"}</button>
    </section>
  );
}
