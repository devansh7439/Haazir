import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The mobile app checks every answer against zod schemas and reuses copies of the web's display logic. This test
// runs the server's real output (a krait-bite referral played through the scripted hospitals) through both, so a
// server change that the app can't read, or a web change the app hasn't copied, fails here.

import { setClock } from "@/lib/core/clock";
import { setDb, type Db } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { MaintenanceService } from "@/lib/modules/maintenance/maintenance.service";
import { MobileService } from "@/lib/modules/mobile/mobile.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { ViewService } from "@/lib/modules/referral/view.service";
import type { ReferralView as WebView } from "@/lib/modules/referral/view.type";
import * as webBoard from "@/lib/ui/board";
import * as webDisplay from "@/lib/ui/display";
import * as webFacility from "@/lib/ui/facility";
import type { FacilityListItem as WebFacility } from "@/lib/modules/facility/facility.type";

import * as appBoard from "../mobile/src/lib/board";
import * as appDisplay from "../mobile/src/lib/display";
import * as appFacility from "../mobile/src/lib/facility";
import {
  BootstrapSchema, FacilityListSchema, PreviewSchema, ReferralListSchema, ReferralViewSchema,
} from "../mobile/src/api/schema";
import { SelectedSchema, TickSchema } from "../mobile/src/api/referral.repository";
import { IDS, fakeClock, freshDb } from "./helpers";
import { KRAIT, advanceCalls, fakeBolna } from "./support/scripted-calls";

const json = <T>(v: unknown): T => JSON.parse(JSON.stringify(v));

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

/** Plays the krait-bite referral and returns the board view at several moments: searching, options ready, confirmed. */
async function playKrait(): Promise<{
  referralId: string;
  views: Array<{ at: number; view: WebView }>;
  /** What the select and tick routes answered during the play, as JSON. */
  answers: { select: unknown; ticks: unknown[] };
}> {
  const clock = fakeClock();
  fakeBolna();
  const { referral } = await ReferralService.create(KRAIT);
  const views: Array<{ at: number; view: WebView }> = [];
  const answers: { select: unknown; ticks: unknown[] } = { select: null, ticks: [] };
  let selected = false;
  for (let t = 0; t <= 240; t++) {
    await advanceCalls(referral.id);
    await EvaluationService.evaluate(referral.id);
    const r = (await ReferralRepository.get(referral.id))!;
    if (t % 40 === 0) answers.ticks.push(json(await MaintenanceService.tickReferral(r)));
    if (!selected && r.status === "options_ready" && t >= 45) {
      const tamarind = (await CallRepository.listForReferral(referral.id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
      answers.select = json(await HoldService.select(referral.id, tamarind.id));
      selected = true;
    }
    if ([3, 20, 40, 100, 240].includes(t)) views.push({ at: t, view: json((await ViewService.get(referral.id))!) });
    clock.advance(1);
  }
  return { referralId: referral.id, views, answers };
}

describe("the app's schemas accept what the server sends", () => {
  it("referral view, at every stage of a krait-bite referral", async () => {
    const { views } = await playKrait();
    expect(views.at(-1)!.view.referral.status).toBe("confirmed");
    for (const { at, view } of views) {
      const parsed = ReferralViewSchema.safeParse(view);
      expect(parsed.success, `t=${at}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it("referral list, hospitals, bootstrap and preview", async () => {
    fakeBolna();
    await ReferralService.create(KRAIT);
    expect(ReferralListSchema.safeParse({ referrals: json(await ViewService.list(DEFAULT_ORG_ID)) }).success).toBe(true);
    expect(FacilityListSchema.safeParse({ facilities: json(await DirectoryService.list(DEFAULT_ORG_ID)) }).success).toBe(true);
    const boot = await MobileService.bootstrap({ uid: null, org: DEFAULT_ORG_ID, role: "admin", rid: null, name: null, email: null });
    expect(BootstrapSchema.safeParse(json(boot)).success).toBe(true);
    const input: Record<string, unknown> = { ...KRAIT };
    delete input.patient;
    const preview = await ReferralService.preview(input as never, { orgId: DEFAULT_ORG_ID });
    const parsed = PreviewSchema.safeParse(json(preview));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.eligible.filter((e) => e.will_call).length).toBe(6);
  });
});

describe("the app's repository checks the answers of actions", () => {
  it("select and tick, as the server answers them during a krait-bite referral", async () => {
    const { answers } = await playKrait();
    const select = SelectedSchema.safeParse(answers.select);
    expect(select.success, JSON.stringify(answers.select)).toBe(true);
    expect(answers.ticks.length).toBeGreaterThan(0);
    for (const tick of answers.ticks) expect(TickSchema.safeParse(tick).success, JSON.stringify(tick)).toBe(true);
  });
});

describe("the bootstrap for each role", () => {
  const session = (role: "admin" | "doctor" | "coordinator", rid: string | null) =>
    ({ uid: null, org: DEFAULT_ORG_ID, role, rid, name: null, email: null }) as const;
  const boot = async (role: "admin" | "doctor" | "coordinator", rid: string | null) =>
    json(await MobileService.bootstrap(session(role, rid)));

  it("is readable by the app for every role", async () => {
    for (const role of ["admin", "doctor", "coordinator"] as const) {
      const parsed = BootstrapSchema.safeParse(await boot(role, null));
      expect(parsed.success, `${role}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
    }
  });

  it("gives a coordinator the doctors to choose from and no default", async () => {
    const b = BootstrapSchema.parse(await boot("coordinator", null));
    expect(b.referrer).toBeNull();
    expect(b.referrers.length).toBeGreaterThan(0);
  });

  it("gives a doctor only themselves, and an admin a default plus the list", async () => {
    const doctor = BootstrapSchema.parse(await boot("doctor", IDS.referrer));
    expect(doctor.referrer?.id).toBe(IDS.referrer);
    expect(doctor.referrers).toEqual([]);
    const admin = BootstrapSchema.parse(await boot("admin", null));
    expect(admin.referrer).not.toBeNull();
    expect(admin.referrers.length).toBeGreaterThan(0);
  });
});

describe("the app's copy of the display logic matches the web's", () => {
  it("statuses, texts, groups and timeline lines for every attempt and event", async () => {
    const { views } = await playKrait();
    const seen = new Set<string>();
    for (const { view } of views) {
      const app = ReferralViewSchema.parse(view);
      const base = new Date(view.server_time).getTime();
      for (const nowMs of [base, base + 90_000]) {
        for (const [i, a] of view.attempts.entries()) {
          const web = webDisplay.attemptDisplay(a, nowMs);
          const mine = appDisplay.attemptDisplay(app.attempts[i], nowMs);
          expect(mine).toEqual(web);
          seen.add(web.text.replace(/\d+:\d+/, "m:ss"));
        }
      }
      const name = (id: unknown) => webDisplay.shortName(view.attempts.find((a) => a.facility_id === id)?.facility_name);
      for (const [i, e] of view.events.entries()) expect(appDisplay.eventText(app.events[i], name)).toEqual(webDisplay.eventText(e, name));

      expect(appBoard.cardsOf(app.attempts).map((c) => [c.a.id, c.calls])).toEqual(webBoard.cardsOf(view.attempts).map((c) => [c.a.id, c.calls]));
      const app_groups = appBoard.groupCards(appBoard.cardsOf(app.attempts), base).map((g) => [g.g, g.items.map((c) => c.a.id)]);
      const web_groups = webBoard.groupCards(webBoard.cardsOf(view.attempts), base).map((g) => [g.g, g.items.map((c) => c.a.id)]);
      expect(app_groups).toEqual(web_groups);
      expect(appBoard.searchTimes(app.referral as never, app.events as never, base)).toEqual(webBoard.searchTimes(view.referral, view.events, base));
      expect(appBoard.holdState(app).hold?.id).toBe(webBoard.holdState(view).hold?.id);
      expect(appBoard.holdState(app).releases.map((a) => a.id)).toEqual(webBoard.holdState(view).releases.map((a) => a.id));
      expect(appBoard.holdState(app).expired).toBe(webBoard.holdState(view).expired);
      expect(appBoard.isLive(app)).toBe(webBoard.isLive(view));
      expect(appBoard.isIdle(app)).toBe(webBoard.isIdle(view));
      expect(appBoard.nextReferralId(app.events as never)).toBe(webBoard.nextReferralId(view.events));
    }
    // The scripted run covers the states that matter, so the comparison above is not vacuous.
    expect([...seen].some((t) => t.startsWith("On call"))).toBe(true);
    expect(seen.has("Accepted")).toBe(true);
    expect(seen.has("Bed held")).toBe(true);
    expect(seen.has("Wants to talk to you")).toBe(true);
    expect(seen.has("No answer")).toBe(true);
  });

  it("labels, referral statuses and small helpers", () => {
    expect(appDisplay.REFERRAL_STATUS).toEqual(webDisplay.REFERRAL_STATUS);
    expect(appDisplay.BED_LABEL).toEqual(webDisplay.BED_LABEL);
    expect(appDisplay.LANGUAGE_LABEL).toEqual(webDisplay.LANGUAGE_LABEL);
    for (const s of [0, 5, 59, 60, 125, 3600]) expect(appDisplay.mmss(s)).toBe(webDisplay.mmss(s));
    expect(appDisplay.clock("2026-11-01T09:05:00Z")).toBe(webDisplay.clock("2026-11-01T09:05:00Z"));
    expect(appDisplay.shortName("Tamarind District Hospital (Demo)")).toBe(webDisplay.shortName("Tamarind District Hospital (Demo)"));
    expect(appBoard.GROUP_TITLE).toEqual(webBoard.GROUP_TITLE);
    expect(appBoard.GROUP_ORDER).toEqual(webBoard.GROUP_ORDER);
  });

  it("the manual-outcome form opens empty unless an answer is on record, on both", () => {
    for (const display of [webDisplay, appDisplay]) {
      const blank = { outcome: "", bed: "" };
      expect(display.manualOutcomeStart({ outcome: null, bed_type: null, needs_review: false })).toEqual(blank);
      expect(display.manualOutcomeStart({ outcome: "unclear", bed_type: "icu", needs_review: false })).toEqual(blank);
      expect(display.manualOutcomeStart({ outcome: "needs_doctor", bed_type: null, needs_review: false })).toEqual(blank);
      // An answer waiting for review must not be one tap from being cleared.
      expect(display.manualOutcomeStart({ outcome: "accepted", bed_type: "icu", needs_review: true })).toEqual(blank);
      expect(display.manualOutcomeStart({ outcome: "accepted", bed_type: "icu", needs_review: false })).toEqual({ outcome: "accepted", bed: "icu" });
      expect(display.manualOutcomeStart({ outcome: "accepted", bed_type: "none", needs_review: false })).toEqual({ outcome: "accepted", bed: "" });

      expect(display.manualOutcomeReady("", "")).toBe(false);
      expect(display.manualOutcomeReady("", "icu")).toBe(false);
      expect(display.manualOutcomeReady("accepted", "")).toBe(false);
      expect(display.manualOutcomeReady("conditional", "")).toBe(false);
      expect(display.manualOutcomeReady("accepted", "icu")).toBe(true);
      expect(display.manualOutcomeReady("declined", "")).toBe(true);
    }
  });

  it("offers to widen only when that would search further, on both", () => {
    for (const display of [webDisplay, appDisplay]) {
      expect(display.canWiden(40)).toBe(true);
      expect(display.canWiden(79)).toBe(true);
      expect(display.canWiden(80)).toBe(false);
      expect(display.canWiden(120)).toBe(false);
    }
    expect(appDisplay.canWiden(undefined)).toBe(true); // an older server doesn't send the radius
  });

  it("hospital helpers: search, grouping, first desk", async () => {
    const rows = json<WebFacility[]>(await DirectoryService.list(DEFAULT_ORG_ID));
    const app = FacilityListSchema.parse({ facilities: rows }).facilities;
    expect(rows.length).toBeGreaterThan(5);
    for (const q of ["", "tamarind", "hoskote", "zzz"]) {
      expect(appFacility.filterFacilities(app, q, []).map((f) => f.id)).toEqual(webFacility.filterFacilities(rows, q, []).map((f) => f.id));
    }
    expect(appFacility.filterFacilities(app, "", ["icu_bed"]).map((f) => f.id)).toEqual(webFacility.filterFacilities(rows, "", ["icu_bed"]).map((f) => f.id));
    for (const [i, f] of rows.entries()) expect(appFacility.firstDesk(app[i])?.id).toBe(webFacility.firstDesk(f)?.id);
    expect(appFacility.KIND_LABEL).toEqual(webFacility.KIND_LABEL);
    expect(appFacility.CONTACT_ROLE_LABEL).toEqual(webFacility.CONTACT_ROLE_LABEL);
    expect(appFacility.mapsLink(13.1, 77.8)).toBe(webFacility.mapsLink(13.1, 77.8));
  });
});
