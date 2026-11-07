import { NextResponse } from "next/server";
import { ApiError } from "@/lib/core/error";
import { handle } from "@/lib/core/route";
import { MAX_ATTACHMENT_BYTES } from "@/lib/modules/attachment/attachment.helper";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { AttachmentKindField } from "@/lib/modules/attachment/attachment.validation";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    const [files, links] = await Promise.all([AttachmentService.list(r.id), AttachmentService.hospitalLinks(r)]);
    return NextResponse.json({ attachments: files, hospital_links: links });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    // A cross-site <form> can't set a custom header, so this blocks form-based CSRF on the multipart upload
    // (parseBody does the same for JSON).
    if (req.headers.get("x-haazir-upload") !== "1") throw ApiError.badRequest("UPLOAD_HEADER_MISSING", "Upload from the console");
    // Refuse a huge body before reading it; the 64 KB allows for the form's own framing.
    if (Number(req.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) {
      throw ApiError.unprocessable("FILE_TOO_LARGE", "Files can be up to 4 MB. Take a smaller photo or a lower-resolution scan.");
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) throw ApiError.unprocessable("VALIDATION_FAILED", "file: choose a file");
    const kind = AttachmentKindField.safeParse(form.get("kind"));
    if (!kind.success) throw ApiError.unprocessable("VALIDATION_FAILED", "kind: choose ecg, photo, record or other");
    const meta = await AttachmentService.upload(r, kind.data, new Uint8Array(await file.arrayBuffer()), s.uid);
    return NextResponse.json({ attachment: meta }, { status: 201 });
  });
}
