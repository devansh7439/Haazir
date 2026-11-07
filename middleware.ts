import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, SESSION_COOKIE, bearerToken, gateToken, verifySession } from "@/lib/modules/auth/gate.helper";

// Routes that authenticate with their own secrets or signatures, plus the sign-in page.
const PUBLIC = ["/api/bolna", "/api/bridge", "/api/cron", "/api/whatsapp", "/api/triggers", "/api/attachments", "/login", "/api/login", "/api/logout", "/api/mobile/config", "/hospital", "/api/hospital"];

// Console gate. AUTH_MODE=users: a signed per-user session. Otherwise the shared DEMO_PASSCODE
// (unset = no gate, for local development). Route handlers check the session again and scope data by organisation.
async function signedIn(req: NextRequest): Promise<boolean> {
  // The mobile app sends its token as a Bearer header instead of a cookie.
  const bearer = bearerToken(req.headers);
  if ((process.env.AUTH_MODE ?? "").trim() === "users") {
    return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value ?? bearer, (process.env.SESSION_SECRET ?? "").trim()));
  }
  const passcode = process.env.DEMO_PASSCODE?.trim();
  if (!passcode) return process.env.NODE_ENV !== "production"; // fail closed when a deploy forgot the passcode
  return (req.cookies.get(GATE_COOKIE)?.value ?? bearer) === (await gateToken(passcode));
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
