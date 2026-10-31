import { useState } from "react";
import type { Notice } from "./types";

/** POSTs JSON for one demo action, tracking which action is running and the message to show. */
export function useDemoCall() {
  const [msg, setMsg] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data?.error?.message ?? "That didn't work" });
      return res.ok ? data : null;
    } finally {
      setBusy(null);
    }
  }

  return { msg, setMsg, busy, call };
}
