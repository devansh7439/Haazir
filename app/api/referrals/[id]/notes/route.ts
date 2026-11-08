import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { NoteService } from "@/lib/modules/note/note.service";
import { NoteBody } from "@/lib/modules/note/note.validation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    return NextResponse.json({ notes: await NoteService.list(r) });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    const { body } = await parseBody(req, NoteBody);
    return NextResponse.json({ note: await NoteService.add(s, r, body) }, { status: 201 });
  });
}
