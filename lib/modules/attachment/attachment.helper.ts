// Rules for attachments: what may be uploaded, how the receiving hospital's link is signed. Pure: no I/O, and time comes in
// as a parameter.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AttachmentKind, AttachmentMeta, AttachmentType } from "@/lib/modules/attachment/attachment.type";

/** The largest file one attachment may be. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
/** The most files one referral may carry. */
export const MAX_ATTACHMENTS_PER_REFERRAL = 6;
/** How long a link given to the receiving hospital works. */
export const LINK_TTL_H = 24;

export type UploadCheck = { ok: true; content_type: AttachmentType } | { ok: false; code: string; message: string };

const startsWith = (b: Uint8Array, bytes: number[], at = 0): boolean => bytes.every((v, i) => b[at + i] === v);

/**
 * The type of a file from its first bytes, never from what the browser claimed: a page renamed to .jpg must not be served
 * as one. Null when it is none of the allowed types.
 */
export function sniffContentType(b: Uint8Array): AttachmentType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

/** Whether a file may be added to a referral that already has `existing` attachments. */
export function checkUpload(bytes: Uint8Array, existing: number): UploadCheck {
  if (existing >= MAX_ATTACHMENTS_PER_REFERRAL) {
    const message = `A referral can have ${MAX_ATTACHMENTS_PER_REFERRAL} files. Remove one first.`;
    return { ok: false, code: "TOO_MANY_ATTACHMENTS", message };
  }
  if (bytes.byteLength === 0) return { ok: false, code: "EMPTY_FILE", message: "The file is empty." };
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    const message = `Files can be up to ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB. Take a smaller photo or a lower-resolution scan.`;
    return { ok: false, code: "FILE_TOO_LARGE", message };
  }
  const type = sniffContentType(bytes);
  if (!type) return { ok: false, code: "UNSUPPORTED_FILE", message: "Send a JPEG, PNG or WebP photo, or a PDF." };
  return { ok: true, content_type: type };
}

const KIND_LABEL: Record<AttachmentKind, string> = { ecg: "ECG", photo: "Photo", record: "Record", other: "File" };

/** "ECG", "Photo 1", "Photo 2": a label per file that names no one. A kind with one file has no number. */
export function labelsFor(files: Array<Pick<AttachmentMeta, "id" | "kind">>): Map<string, string> {
  const total = new Map<AttachmentKind, number>();
  for (const f of files) total.set(f.kind, (total.get(f.kind) ?? 0) + 1);
  const seen = new Map<AttachmentKind, number>();
  const labels = new Map<string, string>();
  for (const f of files) {
    const n = (seen.get(f.kind) ?? 0) + 1;
    seen.set(f.kind, n);
    labels.set(f.id, (total.get(f.kind) ?? 0) > 1 ? `${KIND_LABEL[f.kind]} ${n}` : KIND_LABEL[f.kind]);
  }
  return labels;
}

const mac = (id: string, exp: number, secret: string): string =>
  createHmac("sha256", secret).update(`attachment:${id}:${exp}`).digest("hex");

/** The signature for a link to one attachment that stops working at `exp` (seconds since the epoch). */
export const signLink = (id: string, exp: number, secret: string): string => mac(id, exp, secret);

/** Whether a link's signature matches this attachment and has not expired at `nowMs`. */
export function verifyLink(id: string, exp: number, sig: string, secret: string, nowMs: number): boolean {
  if (!secret || !Number.isFinite(exp) || exp * 1000 <= nowMs) return false;
  const want = Buffer.from(mac(id, exp, secret), "hex");
  const got = Buffer.from(sig, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Referral statuses where the receiving hospital may open a signed link: a bed is confirmed, or it was and the case has ended. */
export const LINK_STATUSES = ["confirmed", "closed"];
