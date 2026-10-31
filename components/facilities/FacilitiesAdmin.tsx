"use client";

import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import type { Capability } from "@/lib/core/types";
import { filterFacilities } from "@/lib/ui/facility";
import { PageHeader, Stat } from "../ui";
import { AddHospitalDrawer } from "./AddHospitalDrawer";
import { FacilityDrawer } from "./FacilityDrawer";
import { FacilityProfile } from "./FacilityProfile";
import { FacilityTable, type Ratings } from "./FacilityTable";
import { RequirementsDialog } from "./RequirementsDialog";

/** The Hospitals page: find a hospital by name or by what it offers, open its details, and (admins) list or edit one. */
export function FacilitiesAdmin({ initial, capabilities, canEdit }: { initial: FacilityListItem[]; capabilities: Capability[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initial);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [showServices, setShowServices] = useState(false);
  // Google ratings load after the page, so a slow or missing Google never delays the list. Null when it isn't set up.
  const [ratings, setRatings] = useState<Ratings | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/facilities/ratings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.enabled) setRatings(d.ratings);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const reload = async () => {
    const res = await fetch("/api/facilities", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).facilities);
  };
  const viewing = rows.find((r) => r.id === viewId) ?? null;
  const editing = rows.find((r) => r.id === editId) ?? null;
  const shown = filterFacilities(rows, query, services);
  const toggleService = (code: string) => setServices((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const totalCalls = rows.reduce((n, r) => n + r.availability_calls, 0);
  const totalAnswered = rows.reduce((n, r) => n + r.answered, 0);

  return (
    <div>
      <PageHeader
        title="Hospitals"
        description="What each hospital offers and which desk to call. Haazir asks whether it can take a patient now; direct casualty or referral-desk numbers get answered far more than reception lines."
        actions={
          canEdit ? (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" /> List a hospital
            </button>
          ) : undefined
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hospitals" value={rows.filter((r) => r.active).length} hint={`${rows.filter((r) => !r.active).length} inactive`} />
        <Stat label="Direct desk numbers" value={rows.reduce((n, r) => n + r.contacts.filter((c) => c.active && !c.is_ivr).length, 0)} hint="non-IVR, active" />
        <Stat label="Availability calls" value={totalCalls} />
        <Stat label="Answer rate" value={totalCalls ? `${Math.round((100 * totalAnswered) / totalCalls)}%` : "—"} accent="brand" />
      </div>

      <div className="card">
        <div className="space-y-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input aria-label="Search hospitals" className="input pl-9" placeholder="Search by name, town or district" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <span className="text-xs text-zinc-500">{shown.length} of {rows.length}</span>
            <button type="button" className="btn btn-secondary ml-auto" aria-haspopup="dialog" onClick={() => setShowServices(true)}>
              <SlidersHorizontal aria-hidden className="size-4" /> Requirements{services.length > 0 ? ` (${services.length})` : ""}
            </button>
          </div>
        </div>
        <FacilityTable rows={shown} ratings={ratings} onOpen={setViewId} />
        {rows.length === 0 && <p className="p-10 text-center text-sm text-zinc-500">{canEdit ? "List the hospitals you refer to most." : "No hospitals are listed yet."}</p>}
        {rows.length > 0 && shown.length === 0 && <p className="p-10 text-center text-sm text-zinc-500">No hospital matches. Try fewer services.</p>}
      </div>

      {showServices && (
        <RequirementsDialog
          capabilities={capabilities}
          selected={services}
          matches={shown.length}
          onToggle={toggleService}
          onClear={() => setServices([])}
          onClose={() => setShowServices(false)}
        />
      )}
      {viewing && !editing && (
        <FacilityProfile
          key={viewing.id}
          f={viewing}
          capabilities={capabilities}
          rating={ratings?.[viewing.id] ?? null}
          canEdit={canEdit}
          onEdit={() => setEditId(viewing.id)}
          onClose={() => setViewId(null)}
        />
      )}
      {editing && canEdit && <FacilityDrawer key={editing.id} f={editing} capabilities={capabilities} onClose={() => setEditId(null)} onSaved={reload} />}
      {adding && canEdit && (
        <AddHospitalDrawer
          capabilities={capabilities}
          onClose={() => setAdding(false)}
          onCreated={async (id) => {
            await reload();
            setAdding(false);
            setViewId(id);
          }}
        />
      )}
    </div>
  );
}
