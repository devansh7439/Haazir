import type { EventRow } from "@/lib/core/types";
import type { Audience } from "@/lib/modules/handoff/message.repository";
import type { Alert, AttemptView, MessageView, PortalFlag } from "@/lib/modules/referral/view.type";

const ALERT_TYPES = new Set<string>(["doctor_callback_requested", "inbound_callback", "alert"]);

/** A text field of an event payload, or null when it is missing or not text. */
const text = (payload: unknown, key: string): string | null => {
  const v = payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
  return typeof v === "string" ? v : null;
};

/** A number field of an event payload, or null. */
const num = (payload: unknown, key: string): number | null => {
  const v = payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
  return typeof v === "number" ? v : null;
};

/** Defence in depth: the family call's transcript, recording and extraction are never shown, even if one was stored. */
export const withoutFamilyContent = (attempts: AttemptView[]): AttemptView[] =>
  attempts.map((a) => (a.purpose === "family_update" ? { ...a, transcript: null, recording_url: null, extracted_data: null } : a));

/**
 * What the doctor still has to act on: alerts not dismissed, and "wants to talk to you" requests whose call has no
 * other answer since.
 */
export const alertsOf = (events: EventRow[], attempts: AttemptView[]): Alert[] => {
  const dismissed = new Set(events.filter((e) => e.type === "alert_dismissed").map((e) => num(e.payload, "event_id")));
  const answered = new Set(attempts.filter((a) => a.outcome && a.outcome !== "needs_doctor").map((a) => a.id));
  return events
    .filter((e) => ALERT_TYPES.has(e.type) && !dismissed.has(e.id))
    .filter((e) => !(e.type === "doctor_callback_requested" && e.attempt_id && answered.has(e.attempt_id)))
    .map((e) => ({
      event_id: e.id,
      type: e.type as Alert["type"],
      attempt_id: e.attempt_id,
      facility_name: text(e.payload, "facility_name"),
      number: text(e.payload, "number"),
      reason: text(e.payload, "reason") ?? text(e.payload, "message"),
      contact_person: text(e.payload, "contact_person"),
      kind: text(e.payload, "kind"),
      created_at: new Date(e.created_at).toISOString(),
    }));
};

const AUDIENCES: readonly Audience[] = ["receiving_facility", "referrer", "family", "availability_ping"];
const SEND_STATUSES: ReadonlyArray<MessageView["status"]> = ["sent", "simulated", "failed"];

/** The value if it is one of the allowed ones, otherwise null. */
const oneOf = <T extends string>(allowed: readonly T[], value: string | null): T | null => allowed.find((a) => a === value) ?? null;

/** The WhatsApp messages sent, from their redacted events. An event with an unknown audience or status is skipped. */
export const messagesOf = (events: EventRow[]): MessageView[] =>
  events
    .filter((e) => e.type === "handoff_sent")
    .flatMap((e) => {
      const audience = oneOf(AUDIENCES, text(e.payload, "audience"));
      const status = oneOf(SEND_STATUSES, text(e.payload, "status"));
      if (!audience || !status) return [];
      return [{
        audience,
        to_masked: text(e.payload, "to_masked") ?? "",
        status,
        preview_redacted: text(e.payload, "preview_redacted") ?? "",
        created_at: new Date(e.created_at).toISOString(),
      }];
    });

/** Portal contradictions by attempt id. */
export const portalFlagsOf = (events: EventRow[]): Record<string, PortalFlag> => {
  const flags: Record<string, PortalFlag> = {};
  for (const e of events) {
    if (e.type !== "portal_mismatch" || !e.attempt_id) continue;
    flags[e.attempt_id] = { detail: text(e.payload, "detail") ?? "", source: text(e.payload, "source") ?? "", observed_at: text(e.payload, "observed_at") ?? "" };
  }
  return flags;
};
