"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import type { Capability } from "@/lib/core/types";
import { PageHeader, Stat } from "../ui";
import { FacilityDrawer } from "./FacilityDrawer";
import { FacilityTable } from "./FacilityTable";

export function FacilitiesAdmin({ initial, capabilities, canEdit }: { initial: FacilityListItem[]; capabilities: Capability[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const capLabel = new Map(capabilities.map((c) => [c.code, c.label]));
  const reload = async () => {
    const res = await fetch("/api/facilities", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).facilities);
  };
  const open = rows.find((r) => r.id === openId) ?? null;
  const shown = rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  const totalCalls = rows.reduce((n, r) => n + r.availability_calls, 0);
  const totalAnswered = rows.reduce((n, r) => n + r.answered, 0);

  return (
    <div>
      <PageHeader
        title="Hospitals"
        description="Store what a hospital can do; Haazir asks whether it can take this patient now. Direct casualty or referral-desk numbers get answered far more than reception lines."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hospitals" value={rows.filter((r) => r.active).length} hint={`${rows.filter((r) => !r.active).length} inactive`} />
        <Stat label="Direct desk numbers" value={rows.reduce((n, r) => n + r.contacts.filter((c) => c.active && !c.is_ivr).length, 0)} hint="non-IVR, active" />
        <Stat label="Availability calls" value={totalCalls} />
        <Stat label="Answer rate" value={totalCalls ? `${Math.round((100 * totalAnswered) / totalCalls)}%` : "—"} accent="brand" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input aria-label="Search hospitals" className="input pl-9" placeholder="Search hospitals" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="ml-auto text-xs text-zinc-500">{shown.length} of {rows.length}</span>
        </div>
        <FacilityTable rows={shown} capLabel={capLabel} onOpen={setOpenId} />
        {rows.length === 0 && <p className="p-10 text-center text-sm text-zinc-500">Add the hospitals you refer to most.</p>}
      </div>
      {open && canEdit && <FacilityDrawer key={open.id} f={open} capabilities={capabilities} onClose={() => setOpenId(null)} onSaved={reload} />}
    </div>
  );
}
