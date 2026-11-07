"use client";

import { ClipboardCopy, Eye, FileImage, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { AttachmentKind, AttachmentLink, AttachmentMeta } from "@/lib/modules/attachment/attachment.type";

const KINDS: Array<{ value: AttachmentKind; label: string }> = [
  { value: "ecg", label: "ECG" },
  { value: "photo", label: "Photo" },
  { value: "record", label: "Record" },
  { value: "other", label: "Other" },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * ECGs, photos and records for the receiving doctor. Shared with the hospital only after it confirms the bed: the hospital
 * gets a link that stops working after 24 hours. A photo or record can show the patient's name, so check it before sending.
 */
export function AttachmentsPanel(props: { referralId: string; initial: AttachmentMeta[] }) {
  const [files, setFiles] = useState<AttachmentMeta[]>(props.initial);
  const [links, setLinks] = useState<AttachmentLink[]>([]);
  const [kind, setKind] = useState<AttachmentKind>("ecg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/referrals/${props.referralId}/attachments`;

  async function refresh() {
    const res = await fetch(base);
    if (!res.ok) return;
    const data = await res.json();
    setFiles(data.attachments);
    setLinks(data.hospital_links);
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await fetch(base, { method: "POST", headers: { "x-haazir-upload": "1" }, body: form });
      if (!res.ok) setError((await res.json().catch(() => ({})))?.error?.message ?? "Could not upload the file");
      else await refresh();
    } catch {
      setError("Network error: check the connection and try again");
    }
    if (input.current) input.current.value = "";
    setBusy(false);
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`${base}/${id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({})))?.error?.message ?? "Could not remove the file");
    else await refresh();
  }

  async function copy(url: string, label: string) {
    await navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const linkFor = (index: number) => links[index];

  return (
    <section className="card mt-6 px-5 py-4" aria-labelledby="att-h">
      <h2 id="att-h" className="flex items-center gap-2 text-[15px] font-semibold">
        <Paperclip aria-hidden className="size-4" /> Attachments
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        ECG, photos, records: JPEG, PNG, WebP or PDF, up to 4 MB, at most 6. The hospital gets a link once it confirms the bed.
      </p>
      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {files.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <FileImage aria-hidden className="size-4 text-zinc-500" />
              <span className="font-medium text-zinc-900">{KIND_LABEL[f.kind]}</span>
              <span className="text-xs text-zinc-500">{f.content_type === "application/pdf" ? "PDF" : "Photo"} · {size(f.size_bytes)}</span>
              <span className="ml-auto flex gap-1">
                <a className="btn btn-ghost min-h-8 px-2 text-xs" href={`/api/attachments/${f.id}/file`} target="_blank" rel="noopener noreferrer">
                  <Eye aria-hidden className="size-4" /> View
                </a>
                {linkFor(i) && (
                  <button type="button" className="btn btn-ghost min-h-8 px-2 text-xs" onClick={() => void copy(linkFor(i).url, f.id)}>
                    <ClipboardCopy aria-hidden className="size-4" /> {copied === f.id ? "Copied" : "Hospital link"}
                  </button>
                )}
                <button type="button" className="btn btn-ghost min-h-8 px-2 text-xs" aria-label={`Remove ${KIND_LABEL[f.kind]}`} onClick={() => void remove(f.id)}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select aria-label="What this file is" className="input h-9 w-auto py-0" value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          id="attachment-file"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
        />
        <label htmlFor="attachment-file" className={`btn btn-secondary cursor-pointer${busy ? " opacity-50" : ""}`}>
          {busy ? "Uploading…" : "Add a file"}
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
