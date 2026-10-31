import { Building2, Phone, TriangleAlert } from "lucide-react";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import { LANGUAGE_LABEL, clock, shortName } from "@/lib/ui/display";
import { KIND_LABEL } from "@/lib/ui/facility";
import { cx } from "../ui";
import { Rate } from "./Rate";
import { Stars } from "./Stars";

const COLUMNS = ["Hospital", "Language", "Capabilities", "Numbers", "Answer rate", "Acceptance", "Last called"];
export type Ratings = Record<string, { rating: number; count: number; url: string | null }>;

export function FacilityTable({ rows, capLabel, ratings, onOpen }: { rows: FacilityListItem[]; capLabel: Map<string, string>; ratings: Ratings | null; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-zinc-500">
            {COLUMNS.slice(0, 1).map((c) => <th key={c} className="px-5 py-3 font-medium">{c}</th>)}
            {ratings && <th className="px-5 py-3 font-medium">Google rating</th>}
            {COLUMNS.slice(1).map((c) => <th key={c} className="px-5 py-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((f) => {
            const active = f.contacts.filter((c) => c.active);
            const ivrOnly = active.length > 0 && active.every((c) => c.is_ivr);
            return (
              <tr key={f.id} className={cx("cursor-pointer hover:bg-zinc-50/80", !f.active && "opacity-55")} onClick={() => onOpen(f.id)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100"><Building2 aria-hidden className="size-4 text-zinc-500" /></span>
                    <div>
                      <button className="text-left font-medium text-zinc-900 hover:text-brand-700" onClick={() => onOpen(f.id)}>{shortName(f.name)}</button>
                      <div className="text-xs text-zinc-500">{[KIND_LABEL[f.kind] ?? f.kind, f.city].filter(Boolean).join(" · ")}{f.is_demo ? " · demo" : ""}</div>
                    </div>
                  </div>
                </td>
                {ratings && (
                  <td className="px-5 py-3">
                    {ratings[f.id] ? <Stars {...ratings[f.id]} compact /> : <span className="text-zinc-400">—</span>}
                  </td>
                )}
                <td className="px-5 py-3 text-zinc-700">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}</td>
                <td className="px-5 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {f.capabilities.slice(0, 4).map((c) => <span key={c} className="tag">{capLabel.get(c) ?? c}</span>)}
                    {f.capabilities.length > 4 && <span className="tag">+{f.capabilities.length - 4}</span>}
                    {f.capabilities.length === 0 && <span className="text-xs text-zinc-400">None</span>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 text-zinc-700"><Phone aria-hidden className="size-3.5 text-zinc-400" />{active.length}</span>
                  {ivrOnly && <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700"><TriangleAlert aria-hidden className="size-3" />IVR only</span>}
                </td>
                <td className="px-5 py-3"><Rate n={f.answered} d={f.availability_calls} /></td>
                <td className="px-5 py-3"><Rate n={f.accepted} d={f.answered} /></td>
                <td className="px-5 py-3 text-zinc-500">{f.last_called_at ? clock(f.last_called_at) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
