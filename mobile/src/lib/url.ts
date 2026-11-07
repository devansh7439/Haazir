/**
 * The server address a person typed, as a base URL without a trailing slash, or null when it can't be one.
 * A bare host gets https://, except a local or private address, which gets http:// (an ngrok URL is https).
 */
export function normalizeServerUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;
  const withScheme = /^https?:\/\//i.test(text) ? text : `${local.test(text) ? 'http' : 'https'}://${text}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname || /\s/.test(text)) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}
