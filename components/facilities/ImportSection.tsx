"use client";

import { Download, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportReport } from "@/lib/modules/facility/import.helper";
import { Callout } from "../board/Callout";

const TEMPLATE = [
  "name,kind,city,district,lat,lng,language,casualty_phone,referral_phone,services",
  "Example District Hospital,district hospital,Hoskote,Bengaluru Rural,13.0707,77.7983,kn,080 2345 6789,98450 12345,ICU bed; Ventilator",
].join("\n");

/** Admin: list many hospitals at once from a CSV file. The file is checked first; nothing is saved until the admin confirms. */
export function ImportSection({ services }: { services: Array<{ code: string; label: string }> }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/facilities/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, apply }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error?.message ?? "Import failed");
      else {
        setReport(data);
        if (apply) router.refresh();
      }
    } catch {
      setError("Network error: check the connection and try again");
    }
    setBusy(false);
  }

  return (
    <section className="card mt-8 p-5" aria-labelledby="imp-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="imp-h" className="text-sm font-semibold">Import hospitals</h2>
        <a
          className="btn btn-ghost min-h-8 px-2 text-xs"
          download="haazir-hospitals-template.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
        >
          <Download aria-hidden className="size-3.5" /> Template
        </a>
      </div>
      <p className="mb-3 mt-1 text-xs text-zinc-500">
        Paste or choose a CSV file. Required columns: name, kind, lat, lng. Optional: city, district, address, language, casualty_phone,
        referral_phone, whatsapp, services (separated by ; and written as shown in Haazir: {services.slice(0, 4).map((s) => s.label).join(", ")}…).
        Numbers you import are unverified until a call reaches them.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose a CSV file"
        className="mb-3 block text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            setCsv(await file.text());
            setReport(null);
          }
        }}
      />
      <label className="label" htmlFor="imp-csv">CSV</label>
      <textarea
        id="imp-csv"
        className="input min-h-32 font-mono text-xs"
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setReport(null);
        }}
        placeholder={TEMPLATE}
      />
      {error && <Callout tone="red" icon={TriangleAlert} title={error} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" type="button" disabled={busy || !csv.trim()} onClick={() => void run(false)}>Check file</button>
        {report && !report.applied && report.hospitals.length > 0 && (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void run(true)}>
            List {report.hospitals.length} {report.hospitals.length === 1 ? "hospital" : "hospitals"}
          </button>
        )}
      </div>
      {report && (
        <div className="mt-4 text-sm" role="status">
          <p className="font-medium text-zinc-900">
            {report.applied ? "Listed" : "Ready to list"} {report.hospitals.length}
            {report.issues.length > 0 && `, ${report.issues.length} not ${report.applied ? "listed" : "ready"}`}.
          </p>
          {report.issues.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {report.issues.map((i) => (
                <li key={`${i.line}-${i.message}`} className="px-4 py-2 text-xs">
                  <span className="kbd-num text-zinc-500">Line {i.line}</span>
                  {i.name && <span className="ml-2 font-medium text-zinc-900">{i.name}</span>}
                  <span className="ml-2 text-zinc-700">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
