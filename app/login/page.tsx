"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/ui";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,var(--color-brand-50),transparent_60%)] px-4">
      <form
        className="card w-full max-w-sm p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
          if (!res.ok) {
            setError("That passcode isn't right.");
            setBusy(false);
            return;
          }
          const next = new URLSearchParams(window.location.search).get("next") || "/";
          window.location.href = next.startsWith("/") ? next : "/";
        }}
      >
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in to the console</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter the passcode your team shared.</p>
        <div className="mt-6">
          <label htmlFor="pc" className="label">Passcode</label>
          <input id="pc" type="password" className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        <button className="btn btn-primary mt-5 w-full" type="submit" disabled={busy || !passcode}>
          {busy && <Loader2 aria-hidden className="size-4 animate-spin" />} Continue
        </button>
      </form>
    </div>
  );
}
