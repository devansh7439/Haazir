"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Logo } from "./ui";

export function LoginForm({ mode }: { mode: "passcode" | "users" }) {
  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const users = mode === "users";
  const ready = users ? !!email && !!password : !!passcode;
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,var(--color-brand-50),transparent_60%)] px-4">
      <form
        className="card w-full max-w-sm p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(users ? { email, password } : { passcode }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data?.error?.message ?? "Sign-in failed");
            setBusy(false);
            return;
          }
          const next = new URLSearchParams(window.location.search).get("next") || "/";
          window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
        }}
      >
        <Logo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in to the console</h1>
        <p className="mt-1 text-sm text-zinc-500">{users ? "Use the email and password your admin set up." : "Enter the passcode your team shared."}</p>
        {users ? (
          <>
            <div className="mt-6">
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="mt-3">
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="mt-6">
            <label htmlFor="pc" className="label">Passcode</label>
            <input id="pc" type="password" className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        <button className="btn btn-primary mt-5 w-full" type="submit" disabled={busy || !ready}>
          {busy && <Loader2 aria-hidden className="size-4 animate-spin" />} Continue
        </button>
      </form>
    </div>
  );
}
