import { afterEach, describe, expect, it } from "vitest";

// The pure rules behind the phone app's pages: what counts as in progress, what a search matches, what the form still needs, and
// how saved settings are read back. None of them touch the screen, so each is checked on its own.

import type { ReferralListItem } from "../mobile/src/api/schema";
import { setUiLanguage } from "../mobile/src/lib/i18n";
import { matches, normalizeQuery } from "../mobile/src/lib/search";
import { DEFAULT_SETTINGS, readSettings } from "../mobile/src/lib/settings";
import { isValidAge, missingStep, sendHint } from "../mobile/src/features/referral/referral.helper";
import { inProgressFirst, isInProgress, newestInProgress } from "../mobile/src/features/referrals/referrals.helper";

afterEach(() => setUiLanguage("en"));

type Row = { id: string; status: ReferralListItem["status"] };
const referral = (id: string, status: Row["status"]): Row => ({ id, status });

describe("search", () => {
  it("ignores case and the spaces around what was typed", () => {
    expect(normalizeQuery("  Stroke ")).toBe("stroke");
    expect(matches("  STROKE ", "Acute stroke")).toBe(true);
  });

  it("matches when any field holds the text, and skips empty fields", () => {
    expect(matches("r-45", "Snakebite", "R-4530")).toBe(true);
    expect(matches("r-45", null, undefined, "")).toBe(false);
  });

  it("matches everything while nothing is typed", () => {
    expect(matches("", "anything")).toBe(true);
    expect(matches("   ")).toBe(true);
  });

  it("finds nothing when the text is in none of the fields", () => {
    expect(matches("burns", "Acute stroke", "R-1")).toBe(false);
  });
});

describe("referrals in progress", () => {
  it("counts the four live statuses and no others", () => {
    for (const status of ["searching", "options_ready", "confirming", "confirmed"] as const) expect(isInProgress({ status })).toBe(true);
    for (const status of ["draft", "exhausted", "cancelled", "closed"] as const) expect(isInProgress({ status })).toBe(false);
  });

  it("puts the live ones first and keeps the server's order inside each group", () => {
    const list = [referral("a", "closed"), referral("b", "searching"), referral("c", "cancelled"), referral("d", "confirmed")];
    expect(inProgressFirst(list).map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("names the newest live referral, or none", () => {
    expect(newestInProgress([referral("a", "closed"), referral("b", "searching"), referral("c", "confirmed")])?.id).toBe("b");
    expect(newestInProgress([referral("a", "closed")])).toBeNull();
    expect(newestInProgress([] as Row[])).toBeNull();
  });
});

describe("what the form still needs", () => {
  it("asks for the case, then the urgency, then at least one need", () => {
    expect(missingStep("", "", [])).toBe("Choose a case");
    expect(missingStep("stroke", "", [])).toBe("Set how urgent it is");
    expect(missingStep("stroke", "critical", [])).toBe("Add at least one need");
  });

  it("needs nothing more once those are set, and no need for an other case", () => {
    expect(missingStep("stroke", "critical", ["icu_bed"])).toBeNull();
    expect(missingStep("other", "stable", [])).toBeNull();
  });

  it("says what is missing before anything else", () => {
    expect(sendHint({ missing: "Choose a case", hasPreview: false, willCall: 0, callsReady: true })).toBe("Choose a case");
  });

  it("says when nobody can be called, and when calls are off", () => {
    expect(sendHint({ missing: null, hasPreview: true, willCall: 0, callsReady: true })).toBe("No hospital to call");
    expect(sendHint({ missing: null, hasPreview: true, willCall: 3, callsReady: false })).toBe("Calls are off on this server");
  });

  it("says how many hospitals will be phoned", () => {
    expect(sendHint({ missing: null, hasPreview: true, willCall: 1, callsReady: true })).toBe("Phones 1 hospital at once");
    expect(sendHint({ missing: null, hasPreview: true, willCall: 6, callsReady: true })).toBe("Phones 6 hospitals at once");
  });

  it("speaks Hindi when the screens do", () => {
    setUiLanguage("hi");
    expect(missingStep("", "", [])).toBe("मामला चुनें");
  });

  it("takes an empty age or a whole number of up to three digits", () => {
    for (const age of ["", "0", "34", "120"]) expect(isValidAge(age)).toBe(true);
    for (const age of ["3.5", "-1", "1234", "abc", " 4"]) expect(isValidAge(age)).toBe(false);
  });
});

describe("saved settings", () => {
  it("starts from the defaults when nothing was saved", () => {
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("reads back what was saved", () => {
    const saved = { radiusKm: 80, useLocation: true, showActivity: true, showRatings: false };
    expect(readSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it("keeps the default for anything missing or of the wrong kind", () => {
    expect(readSettings(JSON.stringify({ radiusKm: "far", useLocation: "yes", showRatings: false }))).toEqual({
      ...DEFAULT_SETTINGS,
      showRatings: false,
    });
    expect(readSettings(JSON.stringify({ radiusKm: -5 }))).toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to the defaults when the saved text is not JSON", () => {
    expect(readSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });
});
