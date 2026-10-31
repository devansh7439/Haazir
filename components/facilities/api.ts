/** Sends one JSON request; null on success, otherwise the message to show the admin. */
export async function send(method: string, url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.error?.message ?? "Save failed";
}
