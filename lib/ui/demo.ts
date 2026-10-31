/** Things to check before a live demo, in the order the run sheet needs them. */
export const PREFLIGHT_CHECKLIST = [
  "Bolna concurrency is at least 10 (trial accounts dial 2 at a time, verified numbers only)",
  "Outbound calling hours are off on every agent",
  "Webhook URL with ?token= is set on the demo agents, all statuses",
  "All phones are off silent and allow unknown callers",
  "Every WhatsApp recipient has messaged our WhatsApp number first",
  "Simulation fallback rehearsed on this machine",
];

/** "Never" for null, a relative time up to an hour, then an IST date and time. */
export function ago(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "Never";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}
