import "server-only";
import { one, q } from "@/lib/core/db";
import type { AttachmentFile, AttachmentKind, AttachmentMeta, AttachmentType } from "@/lib/modules/attachment/attachment.type";

const META = "id, kind, content_type, size_bytes, created_at";

/** Attachments of referrals (`referral_attachments`, server-only). */
export const AttachmentRepository = {
  insert: (a: { referral_id: string; kind: AttachmentKind; content_type: AttachmentType; data: Uint8Array; created_by: string | null }, at: Date) =>
    one<AttachmentMeta>(
      `insert into referral_attachments (referral_id, kind, content_type, size_bytes, data, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7) returning ${META}`,
      [a.referral_id, a.kind, a.content_type, a.data.byteLength, a.data, a.created_by, at],
    ),

  /** The referral's attachments, oldest first, without their bytes. */
  list: (referralId: string): Promise<AttachmentMeta[]> =>
    q<AttachmentMeta>(`select ${META} from referral_attachments where referral_id = $1 order by created_at, id`, [referralId]),

  /** One attachment with its bytes, or null. */
  get: (id: string): Promise<AttachmentFile | null> =>
    one<AttachmentFile>(`select ${META}, referral_id, org_id, data from referral_attachments where id = $1`, [id]),

  /** Deletes an attachment of this referral. False when there was none. */
  remove: async (referralId: string, id: string): Promise<boolean> =>
    (await q(`delete from referral_attachments where referral_id = $1 and id = $2 returning id`, [referralId, id])).length > 0,
};
