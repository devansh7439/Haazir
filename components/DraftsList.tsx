"use client";

import { MessageCircle, Mic, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DraftSummary } from "@/lib/modules/intake/intake.service";

// Referral drafts that doctors sent by WhatsApp text or voice note (C2).
export function DraftsList({ initial }: { initial: DraftSummary[] }) {
  const [drafts, setDrafts] = useState(initial);
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby="drafts-h" className="card mb-6 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <MessageCircle aria-hidden className="size-4 text-emerald-600" />
        <h2 id="drafts-h" className="text-sm font-semibold">From WhatsApp</h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600">{drafts.length}</span>
      </div>
      <ul className="divide-y divide-line">
        {drafts.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            {d.kind === "voice" ? <Mic aria-label="Voice note" className="size-4 text-zinc-400" /> : <MessageCircle aria-label="Text" className="size-4 text-zinc-400" />}
            <span className="flex-1 text-zinc-800">{d.parsed.matched.length ? d.parsed.matched.join(" · ") : "Case not recognised"}</span>
            <span className="text-xs text-zinc-400">{new Date(d.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span>
            <Link href={`/?draft=${d.id}`} className="btn btn-secondary min-h-9">Review</Link>
            <button
              aria-label="Dismiss draft"
              className="btn btn-ghost min-h-9 px-2"
              onClick={async () => {
                await fetch(`/api/intake-drafts/${d.id}/dismiss`, { method: "POST" });
                setDrafts((x) => x.filter((y) => y.id !== d.id));
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
