import "server-only";
import { env } from "@/lib/core/config";
import { now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { createLogger } from "@/lib/core/logger";
import type { Referral } from "@/lib/core/types";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { LINK_STATUSES, LINK_TTL_H, checkUpload, labelsFor, signLink, verifyLink } from "@/lib/modules/attachment/attachment.helper";
import { AttachmentRepository } from "@/lib/modules/attachment/attachment.repository";
import type { AttachmentFile, AttachmentKind, AttachmentLink, AttachmentMeta, FileAccess } from "@/lib/modules/attachment/attachment.type";
import { CANCELLABLE } from "@/lib/modules/referral/referral.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

const log = createLogger("attachment");

const linkError = () => ApiError.unauthorized("This link is invalid or has expired");

/** ECGs, photos and records attached to a referral, and the expiring links that hand them to the receiving hospital. */
export const AttachmentService = {
  /** Adds a file. The type comes from the bytes, not from the browser. 422 for a file that is too big, empty or not a photo or PDF. */
  upload: async (referral: Referral, kind: AttachmentKind, bytes: Uint8Array, by: string | null): Promise<AttachmentMeta> => {
    if (!CANCELLABLE.includes(referral.status)) throw ApiError.conflict("NOT_ATTACHABLE", `Referral is ${referral.status}`);
    const existing = (await AttachmentRepository.list(referral.id)).length;
    const check = checkUpload(bytes, existing);
    if (!check.ok) throw ApiError.unprocessable(check.code, check.message);
    const row = { referral_id: referral.id, kind, content_type: check.content_type, data: bytes, created_by: by };
    const meta = await AttachmentRepository.insert(row, now());
    if (!meta) throw ApiError.internal("INSERT_FAILED", "Could not save the file");
    await EventRepository.add(referral.id, "attachment_added", { kind, size_bytes: meta.size_bytes });
    log.info({ referral_id: referral.id, kind, size_bytes: meta.size_bytes }, "attachment added");
    return meta;
  },

  /** The referral's attachments, without their bytes. */
  list: (referralId: string): Promise<AttachmentMeta[]> => AttachmentRepository.list(referralId),

  /** Deletes an attachment. 404 when the referral has no such file. */
  remove: async (referral: Referral, id: string): Promise<void> => {
    if (!(await AttachmentRepository.remove(referral.id, id))) throw ApiError.notFound("File not found");
    await EventRepository.add(referral.id, "attachment_removed", {});
  },

  /**
   * The file for a request: a console session of the same organisation, or a signed link that has not expired while the
   * referral has a confirmed bed. Anything else is 404 for a session and 401 for a link, so ids can't be probed.
   */
  open: async (id: string, access: FileAccess): Promise<AttachmentFile> => {
    const file = await AttachmentRepository.get(id);
    if (access.kind === "session") {
      if (!file || file.org_id !== access.org) throw ApiError.notFound("File not found");
      return file;
    }
    if (!file || !verifyLink(id, access.exp, access.sig, env.attachmentLinkSecret, now().getTime())) throw linkError();
    const referral = await ReferralRepository.get(file.referral_id);
    if (!referral || !LINK_STATUSES.includes(referral.status) || !referral.selected_facility_id) throw linkError();
    return file;
  },

  /**
   * The file for a request that may carry a console session, a signed link, or both. The link is tried first, so hospital
   * staff signed in to some other organisation can still open the link they were sent; a link that fails falls back to the
   * session. 401 when neither works.
   */
  openForRequest: async (
    id: string,
    session: { org: string } | null,
    link: { exp: number; sig: string } | null,
  ): Promise<AttachmentFile> => {
    if (link) {
      try {
        return await AttachmentService.open(id, { kind: "link", ...link });
      } catch (err) {
        if (!session) throw err;
      }
    }
    if (!session) throw ApiError.unauthorized("Sign in, or use the link you were sent");
    return AttachmentService.open(id, { kind: "session", org: session.org });
  },

  /**
   * Links for the receiving hospital, one per file, empty until a bed is confirmed. Also empty without
   * ATTACHMENT_LINK_SECRET or APP_BASE_URL: a link no one can open is worse than none.
   */
  hospitalLinks: async (referral: Referral): Promise<AttachmentLink[]> => {
    const secret = env.attachmentLinkSecret;
    const base = env.appBaseUrl.replace(/\/$/, "");
    if (!secret || !base || !LINK_STATUSES.includes(referral.status) || !referral.selected_facility_id) return [];
    const files = await AttachmentRepository.list(referral.id);
    const labels = labelsFor(files);
    const exp = Math.floor(now().getTime() / 1000) + LINK_TTL_H * 3600;
    return files.map((f) => ({
      label: labels.get(f.id) ?? "File",
      url: `${base}/api/attachments/${f.id}/file?exp=${exp}&sig=${signLink(f.id, exp, secret)}`,
    }));
  },
};
