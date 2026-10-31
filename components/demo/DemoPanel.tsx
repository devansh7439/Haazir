"use client";

import { IdCard, ListChecks, ScrollText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, cx } from "../ui";
import { ChecklistPanel } from "./ChecklistPanel";
import { ConnectionPanel } from "./ConnectionPanel";
import { DemoActions } from "./DemoActions";
import { PhonesPanel } from "./PhonesPanel";
import type { DemoStatus } from "./types";
import { useDemoCall } from "./useDemoCall";

export function DemoPanel({ initial }: { initial: DemoStatus }) {
  const [status, setStatus] = useState(initial);
  const { msg, setMsg, busy, call } = useDemoCall();

  async function refresh() {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }

  return (
    <div>
      <PageHeader
        title="Demo console"
        description="Assign phones, rehearse each desk, and run the krait-bite story live or as a labelled simulation."
        actions={<DemoActions busy={busy} liveReady={!!(status.config.bolna_api_key && status.config.availability_agent)} call={call} onNotice={setMsg} onReset={refresh} />}
      />
      <nav aria-label="Demo tools" className="-mt-2 mb-5 flex flex-wrap gap-2">
        <Link href="/demo/run-sheet" className="btn btn-secondary min-h-9"><ScrollText aria-hidden className="size-4" /> Run sheet</Link>
        <Link href="/demo/judge-cards" className="btn btn-secondary min-h-9"><IdCard aria-hidden className="size-4" /> Judge cards</Link>
        <Link href="/demo/test-matrix" className="btn btn-secondary min-h-9"><ListChecks aria-hidden className="size-4" /> Test matrix</Link>
      </nav>
      {msg && (
        <p role="status" className={cx("mb-5 rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset", msg.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200")}>
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <PhonesPanel status={status} onStatus={setStatus} onNotice={setMsg} busy={busy} call={call} />
        <div className="space-y-6">
          <ConnectionPanel status={status} onRefresh={refresh} />
          <ChecklistPanel />
        </div>
      </div>
    </div>
  );
}
