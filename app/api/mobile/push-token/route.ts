import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { PushService } from "@/lib/modules/push/push.service";
import { PushRegisterBody, PushUnregisterBody } from "@/lib/modules/push/push.validation";

/** The app saves this phone's Expo push token after sign-in. */
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const { token, platform } = await parseBody(req, PushRegisterBody);
    await PushService.register(s.org, s.uid, token, platform);
    return NextResponse.json({ ok: true });
  });
}

/** The app forgets this phone's token on sign-out. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const { token } = await parseBody(req, PushUnregisterBody);
    return NextResponse.json({ removed: await PushService.unregister(s.org, token) });
  });
}
