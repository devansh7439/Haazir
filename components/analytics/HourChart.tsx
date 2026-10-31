"use client";

import { useState } from "react";

// One-series bar chart over 24 hours (IST). Single hue, thin rounded bars anchored to the baseline, recessive axis,
// per-bar tooltip on hover or keyboard focus, and a table view for screen readers and exact values.

export interface HourBar {
  hour: number;
  value: number | null; // null = no data for that hour
  label: string; // tooltip line, e.g. "4 of 6 accepted (67%)"
}

export function HourChart({ title, unit, bars, max }: { title: string; unit: "count" | "percent"; bars: HourBar[]; max?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...bars.map((b) => b.value ?? 0));
  const fmt = (v: number) => (unit === "percent" ? `${Math.round(v)}%` : String(v));
  const hasData = bars.some((b) => (b.value ?? 0) > 0);
  return (
    <figure className="card p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        <span className="text-xs text-zinc-500">by hour of day, IST</span>
      </figcaption>
      {!hasData ? (
        <p className="py-10 text-center text-sm text-zinc-500">No calls yet.</p>
      ) : (
        <div className="relative">
          <div className="flex h-40 items-end gap-[2px] border-b border-zinc-200" role="img" aria-label={`${title} by hour; exact values are in the table below`}>
            {bars.map((b) => {
              const h = b.value === null ? 0 : Math.max((b.value / top) * 100, b.value > 0 ? 2 : 0);
              const on = active === b.hour;
              return (
                <button
                  key={b.hour}
                  type="button"
                  aria-label={`${String(b.hour).padStart(2, "0")}:00, ${b.label}`}
                  className="group relative flex h-full flex-1 items-end focus-visible:outline-2 focus-visible:outline-brand-500"
                  onMouseEnter={() => setActive(b.hour)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(b.hour)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={`block w-full rounded-t-[4px] transition-colors ${b.value === null ? "" : on ? "bg-brand-700" : "bg-brand-500"}`}
                    style={{ height: `${h}%` }}
                  />
                  {on && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-zinc-700 shadow-lg">
                      <span className="font-semibold text-zinc-900">{String(b.hour).padStart(2, "0")}:00</span> · {b.value === null ? "no calls" : fmt(b.value)}
                      <span className="block text-zinc-500">{b.label}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400" aria-hidden>
            {[0, 6, 12, 18, 23].map((h) => <span key={h}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
        </div>
      )}
      <details className="mt-3 text-xs text-zinc-500">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th className="py-1 font-medium">Hour</th><th className="py-1 font-medium">{title}</th><th className="py-1 font-medium">Detail</th></tr></thead>
          <tbody>
            {bars.filter((b) => b.value !== null).map((b) => (
              <tr key={b.hour} className="border-t border-line"><td className="py-1">{String(b.hour).padStart(2, "0")}:00</td><td className="py-1 tabular-nums">{fmt(b.value!)}</td><td className="py-1">{b.label}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
