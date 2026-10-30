// Passcode gate for the console (MVP). Works in the Edge middleware and in Node routes.
export const GATE_COOKIE = "haazir_gate";

export async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`haazir:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
