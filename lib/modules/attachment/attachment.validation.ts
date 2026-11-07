import { z } from "zod";
import { ATTACHMENT_KINDS } from "@/lib/modules/attachment/attachment.type";

/** The text field next to the file in POST /api/referrals/[id]/attachments (multipart). */
export const AttachmentKindField = z.enum(ATTACHMENT_KINDS);

/** GET /api/attachments/[id]/file: a signed link's query. */
export const LinkQuery = z.object({ exp: z.coerce.number().int().positive(), sig: z.string().regex(/^[0-9a-f]{64}$/) });
