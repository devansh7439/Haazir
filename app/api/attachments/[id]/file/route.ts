import { ApiError } from "@/lib/core/error";
import { handle } from "@/lib/core/route";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { LinkQuery } from "@/lib/modules/attachment/attachment.validation";
import { getSession } from "@/lib/modules/auth/session.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The bytes of one attachment. Authenticates itself (middleware lets it through): a console session of the same
 * organisation, or the signed expiring link given to the receiving hospital. Served so a browser shows it and never runs it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!UUID.test(id)) throw ApiError.notFound("File not found");
    const session = await getSession();
    const url = new URL(req.url);
    const link = LinkQuery.safeParse({ exp: url.searchParams.get("exp"), sig: url.searchParams.get("sig") });
    if (!session && !link.success) throw ApiError.unauthorized("Sign in, or use the link you were sent");
    // A link is tried first, so hospital staff signed in to some other organisation can still open the link they were sent.
    let file = null;
    if (link.success) {
      try {
        file = await AttachmentService.open(id, { kind: "link", ...link.data });
      } catch (err) {
        if (!session) throw err;
      }
    }
    if (!file) file = await AttachmentService.open(id, { kind: "session", org: session!.org });
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
