"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="card mx-auto mt-12 max-w-sm space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
        if (!res.ok) {
          setError("That passcode isn't right.");
          return;
        }
        const next = new URLSearchParams(window.location.search).get("next") || "/";
        window.location.href = next.startsWith("/") ? next : "/";
      }}
    >
      <h1 className="text-xl font-bold">Console passcode</h1>
      <div>
        <label htmlFor="pc" className="label">Passcode</label>
        <input id="pc" type="password" className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
      </div>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" type="submit">Enter</button>
    </form>
  );
}
