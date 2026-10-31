import { ExternalLink, MapPin, Pencil, Phone, ShieldCheck, TriangleAlert, X } from "lucide-react";
import dynamic from "next/dynamic";
import type { Capability } from "@/lib/core/types";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import { LANGUAGE_LABEL, clock, shortName } from "@/lib/ui/display";
import { Stars } from "./Stars";
import { CONTACT_ROLE_LABEL, KIND_LABEL, OWNERSHIP_LABEL, firstDesk, groupByCategory, mapsLink, telLink } from "@/lib/ui/facility";

const HospitalMap = dynamic(() => import("./HospitalMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-zinc-400">Loading map…</div>,
});

/** A hospital's page for everyone: what it offers, which desk to ring and where it is. Admins can edit it. */
export function FacilityProfile(props: {
  f: FacilityListItem;
  capabilities: Capability[];
  rating: { rating: number; count: number; url: string | null } | null;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { f } = props;
  const desk = firstDesk(f);
  const groups = groupByCategory(props.capabilities, f.capabilities);
  const place = [f.address, f.city, f.district].filter(Boolean).join(", ");
  const active = f.contacts.filter((c) => c.active);
  const ivrOnly = active.length > 0 && active.every((c) => c.is_ivr);

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-zinc-950/30 backdrop-blur-[2px]" onClick={props.onClose}>
      <aside role="dialog" aria-labelledby="fp-h" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id="fp-h" className="text-lg font-semibold tracking-tight">{shortName(f.name)}</h2>
            <p className="text-sm text-zinc-500">
              {KIND_LABEL[f.kind] ?? f.kind} · {OWNERSHIP_LABEL[f.ownership] ?? f.ownership}
              {!f.active && " · not taking referrals"}
            </p>
            {props.rating && <div className="mt-1"><Stars {...props.rating} /></div>}
          </div>
          <button aria-label="Close" className="btn btn-ghost px-2.5" onClick={props.onClose}><X aria-hidden className="size-5" /></button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {desk ? (
              <a className="btn btn-primary" href={telLink(desk.phone_e164)}>
                <Phone aria-hidden className="size-4" /> Call {CONTACT_ROLE_LABEL[desk.role]?.toLowerCase() ?? "desk"}
              </a>
            ) : (
              <span className="text-sm text-zinc-500">No desk number listed yet.</span>
            )}
            <a className="btn btn-secondary" href={mapsLink(f.lat, f.lng)} target="_blank" rel="noreferrer">
              <MapPin aria-hidden className="size-4" /> Directions <ExternalLink aria-hidden className="size-3.5 text-zinc-400" />
            </a>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold">What it offers</h3>
            {groups.length === 0 ? (
              <p className="text-sm text-zinc-500">No services listed yet.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.category}>
                    <div className="eyebrow mb-1.5">{g.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((c) => <span key={c.code} className="tag text-[13px]">{c.label}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Desk numbers</h3>
            {ivrOnly && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-800">
                <TriangleAlert aria-hidden className="size-3.5" /> Only phone-menu lines are listed. A direct desk number works better.
              </p>
            )}
            {f.contacts.length === 0 ? (
              <p className="text-sm text-zinc-500">None listed.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {f.contacts.map((c) => (
                  <li key={c.id} className={`flex flex-wrap items-center gap-2 px-4 py-3 text-sm ${c.active ? "" : "opacity-55"}`}>
                    <a className="kbd-num font-medium text-zinc-900 underline-offset-2 hover:underline" href={telLink(c.phone_e164)}>{c.phone_e164}</a>
                    <span className="text-zinc-600">{CONTACT_ROLE_LABEL[c.role] ?? c.role}</span>
                    {c.is_ivr && <span className="tag bg-amber-50 text-amber-800">Phone menu</span>}
                    {c.verified_at && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck aria-hidden className="size-3.5" />verified</span>}
                    {!c.active && <span className="tag">not in use</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Location</h3>
            <div className="h-52 overflow-hidden rounded-xl border border-line">
              <HospitalMap lat={f.lat} lng={f.lng} name={f.name} />
            </div>
            <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-zinc-500">Address</dt>
              <dd className="text-zinc-800">{place || "Not listed"}</dd>
              <dt className="text-zinc-500">Coordinates</dt>
              <dd className="kbd-num text-zinc-800">{f.lat}, {f.lng}</dd>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">How it is called</h3>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-zinc-500">Calls in</dt>
              <dd className="text-zinc-800">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}</dd>
              <dt className="text-zinc-500">Answers</dt>
              <dd className="text-zinc-800">
                {f.availability_calls === 0 ? "Not called yet" : `${f.answered} of ${f.availability_calls} calls${f.last_called_at ? ` · last ${clock(f.last_called_at)}` : ""}`}
              </dd>
            </dl>
          </section>
        </div>

        {props.canEdit && (
          <div className="flex items-center justify-end border-t border-line px-6 py-4">
            <button className="btn btn-secondary" onClick={props.onEdit}><Pencil aria-hidden className="size-4" /> Edit</button>
          </div>
        )}
      </aside>
    </div>
  );
}
