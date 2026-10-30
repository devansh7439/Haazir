import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, SESSION_COOKIE, gateToken, verifySession } from "./lib/gate";

// Routes that authenticate with their own secrets or signatures, plus the sign-in page.
const PUBLIC = ["/api/bolna", "/api/cron", "/api/whatsapp", "/api/triggers", "/login", "/api/login", "/api/logout"];

// Console gate. AUTH_MODE=users: a signed per-user session. Otherwise the shared DEMO_PASSCODE
// (unset = no gate, for local development). Route handlers check the session again and scope data by organisation.
async function signedIn(req: NextRequest): Promise<boolean> {
  if ((process.env.AUTH_MODE ?? "").trim() === "users") {
    return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value, (process.env.SESSION_SECRET ?? "").trim()));
  }
  const passcode = process.env.DEMO_PASSCODE?.trim();
  if (!passcode) return true;
  return req.cookies.get(GATE_COOKIE)?.value === (await gateToken(passcode));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (await signedIn(req)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in to the console", details: {} } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
