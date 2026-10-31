// Where to go after signing in. Only same-site paths: "//evil.com", "/\evil.com" (browsers treat "\" as "/"),
// absolute URLs and javascript: all fall back to "/".
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const base = "http://haazir.invalid";
    const u = new URL(next, base);
    return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : "/";
  } catch {
    return "/";
  }
}
