import { NextResponse } from "next/server";
import { errorResponse, handle, parseBody } from "@/lib/core/route";
import { clientIp } from "@/lib/integrations/bolna/bolna.auth";
import { LoginBody } from "@/lib/modules/auth/auth.validation";
import { AuthService } from "@/lib/modules/auth/auth.service";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function POST(req: Request) {
  return handle(async () => {
    const result = await AuthService.signIn(await parseBody(req, LoginBody), clientIp(req));
    if (!result.ok) return errorResponse(result.status, result.code, result.message);
    // The mobile app has no cookie jar: it asks for the token in the body and sends it back as a Bearer header.
    const wantsToken = req.headers.get("x-haazir-client") === "mobile";
    const res = NextResponse.json(wantsToken ? { ok: true, token: result.cookie?.value ?? null } : { ok: true });
    if (result.cookie) res.cookies.set(result.cookie.name, result.cookie.value, cookieOpts(result.cookie.maxAge));
    return res;
  });
}
