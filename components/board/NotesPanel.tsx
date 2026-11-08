"use client";

import { NotebookPen } from "lucide-react";
import { useState } from "react";
import type { ReferralNote } from "@/lib/modules/note/note.type";

const MAX = 500;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Handover notes: what is done and what is pending, so whoever takes over this referral does not start from the timeline.
 * Shown to everyone in the organisation, newest first.
 */
export function NotesPanel(props: { referralId: string; initial: ReferralNote[] }) {
  const [notes, setNotes] = useState(props.initial);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/referrals/${props.referralId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((n) => [data.note, ...n]);
        setText("");
      } else {
        setError(data?.error?.message ?? "Could not save the note");
      }
    } catch {
      setError("Network error: check the connection and try again");
    }
    setSaving(false);
  }

  return (
    <section className="card mt-6 px-5 py-4" aria-labelledby="notes-h">
      <h2 id="notes-h" className="flex items-center gap-2 text-[15px] font-semibold">
        <NotebookPen aria-hidden className="size-4" /> Handover notes
      </h2>
      <form onSubmit={add} className="mt-3">
        <label className="label" htmlFor="note-text">What is done and what is pending</label>
        <textarea
          id="note-text"
          className="input min-h-20"
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Banyan said yes, waiting on Dr Kiran to confirm the ventilator."
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">Don&apos;t write the patient&apos;s name or a phone number.</p>
          <button type="submit" className="btn btn-secondary min-h-8 px-3 text-xs" disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      </form>
      {notes.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {notes.map((n) => (
            <li key={n.id} className="py-2.5 text-sm">
              <p className="text-zinc-800">{n.body}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{n.author_name} · {when(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
