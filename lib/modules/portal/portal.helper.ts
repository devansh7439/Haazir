import type { Outcome } from "@/lib/core/types";

// "Portal says free, desk says full" (C4). Pure comparison used by lib/portal.ts.

export interface PortalReading {
  icu_beds_free: number | null;
  ventilators_free: number | null;
}

/** Returns a short description of the mismatch, or null when the desk's answer and the portal agree. */
export function portalMismatch(outcome: Outcome | null, declineReason: string | null, p: PortalReading): string | null {
  const icu = p.icu_beds_free;
  const vent = p.ventilators_free;
  if (outcome === "declined") {
    const reason = (declineReason ?? "").toLowerCase();
    const aboutVentilator = reason.includes("ventilator");
    const aboutBeds = /bed|full|icu/.test(reason) || reason === "";
    if (aboutVentilator && vent !== null && vent > 0) return `portal showed ${vent} ventilator${vent === 1 ? "" : "s"} free`;
    if (aboutBeds && icu !== null && icu > 0) return `portal showed ${icu} ICU bed${icu === 1 ? "" : "s"} free`;
    return null;
  }
  if (outcome === "accepted" || outcome === "conditional") {
    if (icu === 0) return "portal showed no ICU beds free";
  }
  return null;
}
