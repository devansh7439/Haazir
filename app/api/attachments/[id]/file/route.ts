import { ApiError } from "@/lib/core/error";
import { handle } from "@/lib/core/route";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { LinkQuery } from "@/lib/modules/attachment/attachment.validation";
import { SessionService } from "@/lib/modules/auth/session.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The bytes of one attachment. Authenticates itself (middleware lets it through): a console session of the same
 * organisation, or the signed expiring link given to the receiving hospital. Served so a browser shows it and never runs it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!UUID.test(id)) throw ApiError.notFound("File not found");
    const session = await SessionService.get();
    const url = new URL(req.url);
    const link = LinkQuery.safeParse({ exp: url.searchParams.get("exp"), sig: url.searchParams.get("sig") });
    const file = await AttachmentService.openForRequest(id, session, link.success ? link.data : null);
    return new Response(file.data as BodyInit, {
      headers: {
        "Content-Type": file.content_type,
        "Content-Length": String(file.size_bytes),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
      },
    });
  });
}
