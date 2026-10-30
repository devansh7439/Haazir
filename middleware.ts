import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "./lib/gate";

// Console passcode (DEMO_PASSCODE). Bolna routes authenticate with their own secrets.
// Unset passcode = no gate (local development).
export async function middleware(req: NextRequest) {
  const passcode = process.env.DEMO_PASSCODE?.trim();
  if (!passcode) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/bolna/") || pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === (await gateToken(passcode))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Enter the console passcode", details: {} } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
