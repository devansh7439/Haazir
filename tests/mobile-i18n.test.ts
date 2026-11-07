import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// The mobile app shows English or Hindi. These tests keep the Hindi complete and its placeholders intact, and check that the
// English the shared display logic produces (which the app cannot change, see mobile-contract.test.ts) still gets translated.

import { collectStrings } from "../mobile/scripts/strings";
import { HINDI } from "../mobile/src/lib/i18n/hindi";
import { setUiLanguage, t, tFitted, translate } from "../mobile/src/lib/i18n";
import { LISTED, eventLine, statusText } from "../mobile/src/lib/localize";
import { BED_LABEL, LANGUAGE_LABEL, REFERRAL_STATUS, attemptDisplay, eventText, type AttemptLike } from "../mobile/src/lib/display";
import { GROUP_TITLE } from "../mobile/src/lib/board";
import { CONTACT_ROLE_LABEL, KIND_LABEL, OWNERSHIP_LABEL, groupByCategory } from "../mobile/src/lib/facility";

afterEach(() => setUiLanguage("en"));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const english = (phrase: unknown) => phrase as string;

describe("the Hindi wording", () => {
  const strings = collectStrings(join(__dirname, "..", "mobile", "src"));

  it("covers every text the screens show through t() and phrase()", () => {
    const missing = [...strings.keys()].filter((text) => !HINDI[text]);
    expect(missing).toEqual([]);
  });

  it("covers the phrases the display helpers are translated through", () => {
    expect(LISTED.map(english).filter((text) => !HINDI[text])).toEqual([]);
  });

  it("covers the labels the shared display logic supplies", () => {
    const labels = [
      ...Object.values(BED_LABEL),
      ...Object.values(LANGUAGE_LABEL),
      ...Object.values(REFERRAL_STATUS).map((s) => s.text),
      ...Object.values(GROUP_TITLE),
      ...Object.values(KIND_LABEL),
      ...Object.values(OWNERSHIP_LABEL),
      ...Object.values(CONTACT_ROLE_LABEL),
      ...groupByCategory(["bed", "equipment", "service", "specialist", "drug"].map((category) => ({ code: category, label: category, spoken_en: category, category }))).map((g) => g.title),
    ];
    expect(labels.filter((text) => !HINDI[text])).toEqual([]);
  });

  it("keeps every {placeholder} of the English", () => {
    const wrong = Object.entries(HINDI).filter(([text, hindi]) => placeholders(text).join() !== placeholders(hindi).join());
    expect(wrong.map(([text]) => text)).toEqual([]);
  });

  it("has no entry that is not Hindi-script text, a loan word or a name", () => {
    const empty = Object.entries(HINDI).filter(([, hindi]) => !hindi.trim());
    expect(empty).toEqual([]);
  });
});

describe("translating", () => {
  it("shows English as it is and falls back to English where there is no Hindi", () => {
    expect(t("Find a bed")).toBe("Find a bed");
    setUiLanguage("hi");
    expect(t("Find a bed")).toBe("बिस्तर खोजें");
    expect(t("A text nobody has translated")).toBe("A text nobody has translated");
  });

  it("fills placeholders", () => {
    expect(translate("Bed held at {name}", "hi", { name: "Tamarind" })).toBe("Tamarind में बिस्तर रोका गया");
  });

  it("translates a hospital's status around its changing part", () => {
    setUiLanguage("hi");
    expect(statusText("On call · 1:05")).toBe("कॉल पर · 1:05");
    expect(statusText("Declined · no bed")).toBe("मना किया · no bed");
    expect(statusText("Calling back at 14:30")).toBe("14:30 पर वापस कॉल करेंगे");
    expect(statusText("Accepted")).toBe("हाँ कही");
  });

  it("translates every status the display logic can produce", () => {
    const base: AttemptLike = {
      purpose: "availability",
      status: "queued",
      outcome: null,
      needs_review: false,
      decline_reason: "no_bed: full",
      callback_due_at: "2026-11-01T09:05:00Z",
      alternate_number: "+919800000000",
      answered_at: "2026-11-01T09:00:00Z",
    };
    const attempts: AttemptLike[] = [
      { ...base, needs_review: true },
      ...(["accepted", "conditional", "declined", "needs_doctor", "callback_later", "redirected", "ivr_blocked", "unclear", "hold_confirmed", "hold_declined", "release_ack", "arrival_confirmed", "not_arrived"] as const).map(
        (outcome) => ({ ...base, outcome }),
      ),
      ...(["queued", "dialing", "ringing", "in_progress", "wrapping_up", "no_answer", "busy", "failed", "canceled"] as const).map((status) => ({ ...base, status })),
    ];
    setUiLanguage("hi");
    const untranslated = attempts.map((a) => attemptDisplay(a, Date.parse("2026-11-01T09:01:05Z")).text).filter((text) => statusText(text) === text);
    expect(untranslated).toEqual([]);
  });

  it("translates every line of the activity feed", () => {
    const name = () => "Tamarind";
    const events: Array<[string, Record<string, unknown>]> = [
      ["referral_created", {}],
      ["wave_dispatched", { facility_ids: ["a", "b"], wave: 1 }],
      ["call_queued", { purpose: "hold_confirm", facility_id: "a" }],
      ["call_answered", { purpose: "availability", facility_id: "a" }],
      ["call_ended", { status: "no_answer", facility_id: "a" }],
      ["call_ended", { status: "busy", facility_id: "a" }],
      ["call_ended", { status: "failed", facility_id: "a" }],
      ...["accepted", "conditional", "declined", "redirected", "unclear", "ivr_blocked", "needs_doctor", "callback_later"].map(
        (outcome): [string, Record<string, unknown>] => ["outcome_recorded", { outcome, facility_id: "a", source: "manual" }],
      ),
      ["options_ready", { ttfa_seconds: 75 }],
      ["doctor_callback_requested", { facility_id: "a", reason: "needs a word" }],
      ["inbound_callback", { facility_name: "Tamarind", message: "ring us" }],
      ["callback_scheduled", { facility_id: "a", due_at: "2026-11-01T09:05:00Z" }],
      ["redial_dispatched", { facility_id: "a", reason: "no answer" }],
      ["needs_review", { facility_id: "a", function_outcome: "accepted", extraction_outcome: "declined" }],
      ["facility_selected", { facility_id: "a" }],
      ["hold_confirmed", { facility_id: "a", contact_person: "Dr Rao", manual: true }],
      ["hold_declined", { facility_id: "a" }],
      ["handoff_sent", { audience: "receiving_facility", status: "sent" }],
      ["release_dispatched", { facility_id: "a" }],
      ["arrival_check_dispatched", { facility_id: "a" }],
      ["arrival_confirmed", { facility_id: "a" }],
      ["not_arrived", { facility_id: "a" }],
      ["hold_expired", {}],
      ["referral_exhausted", {}],
      ["referral_cancelled", { reason: "Taken elsewhere" }],
      ["referral_closed", { reason: "hold_expired" }],
      ["portal_mismatch", { facility_id: "a", desk_outcome: "accepted", detail: "ICU full", source: "portal" }],
      ["bed_request_sent", { facility_id: "a", status: "sent" }],
      ["family_call_dispatched", { reason: "missed_call" }],
      ["family_call_dispatched", {}],
      ["status_recovered", { facility_id: "a" }],
    ];
    const lines = events.map(([type, payload]) => eventText({ type, payload }, name)).filter((line): line is string => line !== null);
    expect(lines.length).toBeGreaterThan(30);
    setUiLanguage("hi");
    expect(lines.filter((line) => eventLine(line) === line)).toEqual([]);
    expect(eventLine("Tamarind accepted (entered by doctor)")).toBe("Tamarind ने हाँ कही (डॉक्टर ने दर्ज किया)");
    expect(eventLine("WhatsApp to hospital: sent")).toBe("अस्पताल को WhatsApp: भेजा गया");
  });

  it("leaves English alone, and text it has no template for", () => {
    expect(eventLine("Tamarind accepted")).toBe("Tamarind accepted");
    setUiLanguage("hi");
    expect(tFitted("Something the server invented", [])).toBe("Something the server invented");
  });
});
