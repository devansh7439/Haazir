"use client";

import { CheckCircle2, Circle, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TEST_MATRIX, matrixGate, type MatrixEntry, type MatrixResult } from "@/lib/testMatrix";
import { PageHeader, Stat, cx } from "./ui";

const NEXT: Record<MatrixResult, MatrixResult> = { untested: "pass", pass: "fail", fail: "untested" };

function ResultButton({ entry, onChange }: { entry: MatrixEntry | undefined; onChange: (r: MatrixResult) => void }) {
  const r = entry?.result ?? "untested";
  const Icon = r === "pass" ? CheckCircle2 : r === "fail" ? XCircle : Circle;
  return (
    <button
      type="button"
      onClick={() => onChange(NEXT[r])}
      aria-label={`Result: ${r}. Click to change`}
      className={cx(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset",
        r === "pass" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : r === "fail" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-white text-zinc-500 ring-line",
      )}
    >
      <Icon aria-hidden className="size-3.5" /> {r === "untested" ? "Not run" : r === "pass" ? "Pass" : "Fail"}
    </button>
  );
}

export function TestMatrix({ initial }: { initial: MatrixEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const gate = matrixGate(entries);
  const find = (pass: 1 | 2, row: number) => entries.find((e) => e.pass === pass && e.row_no === row);

  async function save(pass: 1 | 2, row_no: number, patch: Partial<MatrixEntry>) {
    const current = find(pass, row_no);
    const body = { pass, row_no, result: current?.result ?? "untested", note: current?.note ?? null, referral_code: current?.referral_code ?? null, ...patch };
    const res = await fetch("/api/test-matrix", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setError("Couldn't save that result");
      return;
    }
    const saved = (await res.json()) as MatrixEntry;
    setError(null);
    setEntries((xs) => [...xs.filter((e) => !(e.pass === pass && e.row_no === row_no)), saved]);
  }

  return (
    <div>
      <PageHeader
        title="Voice test matrix"
        description="Run every scenario with a teammate playing the desk, on real phones. Gate: 20/20 twice in a row, and rows 1, 15 and 16 (a false yes) never fail."
        actions={<Link href="/demo" className="btn btn-secondary">Back to demo console</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pass 1" value={`${gate.passed[0]}/20`} accent={gate.passed[0] === 20 ? "green" : undefined} />
        <Stat label="Pass 2" value={`${gate.passed[1]}/20`} accent={gate.passed[1] === 20 ? "green" : undefined} />
        <Stat label="False-yes failures" value={gate.failedZeroTolerance.length} hint={gate.failedZeroTolerance.length ? `rows ${gate.failedZeroTolerance.join(", ")}` : "rows 1, 15, 16"} />
        <Stat label="Demo-ready" value={gate.ready ? "Yes" : "Not yet"} accent={gate.ready ? "green" : undefined} />
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Tester says or does</th>
              <th className="px-4 py-3 font-medium">Expected in the database</th>
              <th className="px-4 py-3 font-medium">Pass 1</th>
              <th className="px-4 py-3 font-medium">Pass 2</th>
              <th className="px-4 py-3 font-medium">Referral · note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {TEST_MATRIX.map((row) => {
              const p1 = find(1, row.no);
              const p2 = find(2, row.no);
              const latest = p2 ?? p1;
              return (
                <tr key={row.no} className={cx(row.zeroTolerance && "bg-rose-50/30")}>
                  <td className="kbd-num px-4 py-3 align-top font-medium">
                    {row.no}
                    {row.zeroTolerance && <ShieldAlert aria-label="Zero tolerance: never a false yes" className="mt-1 size-4 text-rose-500" />}
                  </td>
                  <td className="px-4 py-3 align-top text-zinc-800">{row.scenario}</td>
                  <td className="px-4 py-3 align-top text-zinc-600">{row.expected}</td>
                  <td className="px-4 py-3 align-top"><ResultButton entry={p1} onChange={(r) => save(1, row.no, { result: r })} /></td>
                  <td className="px-4 py-3 align-top"><ResultButton entry={p2} onChange={(r) => save(2, row.no, { result: r })} /></td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-2">
                      <input
                        aria-label={`Row ${row.no} referral code`}
                        className="input w-24"
                        placeholder="R-4821"
                        defaultValue={latest?.referral_code ?? ""}
                        onBlur={(e) => e.target.value !== (latest?.referral_code ?? "") && save(p2 ? 2 : 1, row.no, { referral_code: e.target.value || null })}
                      />
                      <input
                        aria-label={`Row ${row.no} note`}
                        className="input min-w-48"
                        placeholder="What happened"
                        defaultValue={latest?.note ?? ""}
                        onBlur={(e) => e.target.value !== (latest?.note ?? "") && save(p2 ? 2 : 1, row.no, { note: e.target.value || null })}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
