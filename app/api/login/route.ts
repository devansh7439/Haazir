import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, errorResponse } from "@/lib/api";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

export async function POST(req: Request) {
  return handle(async () => {
    const { passcode } = await parseBody(req, z.object({ passcode: z.string().max(200) }));
    const expected = process.env.DEMO_PASSCODE?.trim();
    if (!expected || passcode.trim() !== expected) return errorResponse(401, "WRONG_PASSCODE", "That passcode isn't right");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GATE_COOKIE, await gateToken(expected), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  });
}
