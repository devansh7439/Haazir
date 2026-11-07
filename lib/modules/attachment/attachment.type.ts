/** What an attachment is for. */
export const ATTACHMENT_KINDS = ["ecg", "photo", "record", "other"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** The file types accepted, read from the bytes. */
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

/** What the browser may see of an attachment. No bytes and no filename. */
export interface AttachmentMeta {
  id: string;
  kind: AttachmentKind;
  content_type: AttachmentType;
  size_bytes: number;
  created_at: Date | string;
}

/** An attachment with its bytes, server-only. */
export interface AttachmentFile extends AttachmentMeta {
  referral_id: string;
  org_id: string;
  data: Uint8Array;
}

/** A link handed to the receiving hospital. */
export interface AttachmentLink {
  label: string;
  url: string;
}

/** What a request for the bytes presents: a console session's organisation, or a signed link. */
export type FileAccess = { kind: "session"; org: string } | { kind: "link"; exp: number; sig: string };
