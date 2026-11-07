import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => new Headers(),
}));

import { setClock } from "@/lib/core/clock";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { AnalyticsService } from "@/lib/modules/analytics/analytics.service";
import {
  MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_REFERRAL, checkUpload, labelsFor, signLink, sniffContentType, verifyLink,
} from "@/lib/modules/attachment/attachment.helper";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { MaintenanceService } from "@/lib/modules/maintenance/maintenance.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import * as attachmentsRoute from "@/app/api/referrals/[id]/attachments/route";
import * as fileRoute from "@/app/api/attachments/[id]/file/route";
import { advanceCalls, fakeBolna, KRAIT } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";

const SECRET = "k".repeat(40);
const BASE = "https://app.example";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  vi.stubEnv("ATTACHMENT_LINK_SECRET", SECRET);
  vi.stubEnv("APP_BASE_URL", BASE);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

describe("what may be uploaded", () => {
  it("knows a file by its first bytes, whatever the browser called it", () => {
    expect(sniffContentType(JPEG)).toBe("image/jpeg");
    expect(sniffContentType(PNG)).toBe("image/png");
    expect(sniffContentType(WEBP)).toBe("image/webp");
    expect(sniffContentType(PDF)).toBe("application/pdf");
    expect(sniffContentType(HTML)).toBeNull();
    expect(sniffContentType(new Uint8Array())).toBeNull();
  });

  it("refuses an empty, oversized, unsupported or surplus file, with a reason a doctor can act on", () => {
    expect(checkUpload(JPEG, 0)).toEqual({ ok: true, content_type: "image/jpeg" });
    expect(checkUpload(new Uint8Array(), 0)).toMatchObject({ ok: false, code: "EMPTY_FILE" });
    expect(checkUpload(HTML, 0)).toMatchObject({ ok: false, code: "UNSUPPORTED_FILE" });
    expect(checkUpload(JPEG, MAX_ATTACHMENTS_PER_REFERRAL)).toMatchObject({ ok: false, code: "TOO_MANY_ATTACHMENTS" });
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    big.set(JPEG);
    expect(checkUpload(big, 0)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("labels files without naming anyone, numbering only repeated kinds", () => {
    const labels = labelsFor([{ id: "a", kind: "ecg" }, { id: "b", kind: "photo" }, { id: "c", kind: "photo" }]);
    expect([...labels.values()]).toEqual(["ECG", "Photo 1", "Photo 2"]);
  });
});

describe("signed links", () => {
  const exp = 2_000_000_000;
  it("verify for the right file before they expire and for nothing else", () => {
    const sig = signLink("file-1", exp, SECRET);
    expect(verifyLink("file-1", exp, sig, SECRET, 1_000_000_000_000)).toBe(true);
    expect(verifyLink("file-2", exp, sig, SECRET, 1_000_000_000_000)).toBe(false);
    expect(verifyLink("file-1", exp + 1, sig, SECRET, 1_000_000_000_000)).toBe(false);
    expect(verifyLink("file-1", exp, sig, "x".repeat(40), 1_000_000_000_000)).toBe(false);
    expect(verifyLink("file-1", exp, sig, SECRET, exp * 1000 + 1)).toBe(false);
    expect(verifyLink("file-1", exp, "zz", SECRET, 1_000_000_000_000)).toBe(false);
    expect(verifyLink("file-1", exp, sig, "", 1_000_000_000_000)).toBe(false);
  });
});

describe("attachments on a referral", () => {
  it("stores the bytes server-side and shows the browser only metadata", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const meta = await AttachmentService.upload(referral, "ecg", PDF, null);
    expect(meta).toMatchObject({ kind: "ecg", content_type: "application/pdf", size_bytes: PDF.byteLength });
    expect(Object.keys(meta).sort()).toEqual(["content_type", "created_at", "id", "kind", "size_bytes"]);
    const file = await AttachmentService.open(meta.id, { kind: "session", org: DEFAULT_ORG_ID });
    expect(Buffer.from(file.data).equals(Buffer.from(PDF))).toBe(true);
    expect((await AttachmentService.list(referral.id)).map((m) => m.id)).toEqual([meta.id]);
    const events = await db.query<{ payload: Record<string, unknown> }>(`select payload from events where referral_id = $1 and type = 'attachment_added'`, [referral.id]);
    expect(events[0].payload).toEqual({ kind: "ecg", size_bytes: PDF.byteLength });
  });

  it("refuses a rejected file, a seventh file and a cancelled referral", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await expect(AttachmentService.upload(referral, "photo", HTML, null)).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
    for (let i = 0; i < MAX_ATTACHMENTS_PER_REFERRAL; i++) await AttachmentService.upload(referral, "photo", JPEG, null);
    await expect(AttachmentService.upload(referral, "photo", JPEG, null)).rejects.toMatchObject({ code: "TOO_MANY_ATTACHMENTS" });
    await ReferralService.cancel(referral.id, "stabilised");
    await expect(AttachmentService.upload({ ...referral, status: "cancelled" }, "photo", JPEG, null)).rejects.toMatchObject({ code: "NOT_ATTACHABLE" });
  });

  it("does not open for another organisation's session", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const meta = await AttachmentService.upload(referral, "photo", JPEG, null);
    await expect(AttachmentService.open(meta.id, { kind: "session", org: "00000000-0000-4000-8000-0000000000b0" })).rejects.toMatchObject({ status: 404 });
  });

  it("removes one file and is deleted with the other identifiers by the retention purge", async () => {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = await AttachmentService.upload(referral, "ecg", PDF, null);
    await AttachmentService.upload(referral, "photo", JPEG, null);
    await AttachmentService.remove(referral, a.id);
    await expect(AttachmentService.remove(referral, a.id)).rejects.toMatchObject({ status: 404 });
    expect(await AttachmentService.list(referral.id)).toHaveLength(1);
    await ReferralService.cancel(referral.id, "stabilised");
    clock.advance(40 * 24 * 3600);
    const purged = await MaintenanceService.purgeIdentifiers(30);
    expect(purged.attachments).toBe(1);
    expect(await AttachmentService.list(referral.id)).toHaveLength(0);
  });
});

describe("the hospital's link", () => {
  /** Runs the krait-bite story until Tamarind's bed is confirmed, with one ECG attached from the start. */
  async function confirmedWithEcg() {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const ecg = await AttachmentService.upload(referral, "ecg", PDF, null);
    let selected = false;
    for (let t = 0; t <= 240; t++) {
      await advanceCalls(referral.id);
      await EvaluationService.evaluate(referral.id);
      const r = await ReferralRepository.get(referral.id);
      if (!selected && r!.status === "options_ready" && t >= 45) {
        const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.facility_id === IDS.tamarind && x.purpose === "availability")!;
        await HoldService.select(referral.id, a.id);
        selected = true;
      }
      clock.advance(1);
    }
    return { referral: (await ReferralRepository.get(referral.id))!, ecg, clock };
  }

  it("is empty until a bed is confirmed", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await AttachmentService.upload(referral, "ecg", PDF, null);
    expect(await AttachmentService.hospitalLinks(referral)).toEqual([]);
  });

  it("is empty without a long enough secret or a public address, one per file otherwise", async () => {
    const { referral: confirmed } = await confirmedWithEcg();
    expect(await AttachmentService.hospitalLinks(confirmed)).toHaveLength(1);
    vi.stubEnv("ATTACHMENT_LINK_SECRET", "too short");
    expect(await AttachmentService.hospitalLinks(confirmed)).toEqual([]);
    vi.stubEnv("ATTACHMENT_LINK_SECRET", SECRET);
    vi.stubEnv("APP_BASE_URL", "");
    expect(await AttachmentService.hospitalLinks(confirmed)).toEqual([]);
  });

  it("goes in the pre-arrival note, and the console preview only counts the files", async () => {
    const { referral, ecg } = await confirmedWithEcg();
    const [note] = await db.query<{ body: string }>(`select body from messages where referral_id = $1 and audience = 'receiving_facility'`, [referral.id]);
    expect(note.body).toMatch(new RegExp(`\\nECG: ${BASE}/api/attachments/${ecg.id}/file\\?exp=\\d+&sig=[0-9a-f]{64}\\n`));
    const events = await db.query<{ payload: { audience: string; preview_redacted: string } }>(`select payload from events where referral_id = $1 and type = 'handoff_sent'`, [referral.id]);
    const preview = events.find((e) => e.payload.audience === "receiving_facility")!.payload.preview_redacted;
    expect(preview).toContain("Attachments: 1 file(s)");
    expect(preview).not.toContain("sig=");
    expect(preview).not.toContain("/api/attachments/");
  });

  it("opens the file for a valid link, and refuses an expired, forged, or cancelled-referral link", async () => {
    const { referral, ecg, clock } = await confirmedWithEcg();
    const [link] = await AttachmentService.hospitalLinks(referral);
    const q = new URL(link.url).searchParams;
    const access = { kind: "link" as const, exp: Number(q.get("exp")), sig: q.get("sig")! };
    expect((await AttachmentService.open(ecg.id, access)).content_type).toBe("application/pdf");
    await expect(AttachmentService.open(ecg.id, { ...access, sig: "0".repeat(64) })).rejects.toMatchObject({ status: 401 });
    // A real signature for another file does not open this one.
    const other = await AttachmentService.upload(referral, "photo", JPEG, null);
    await expect(AttachmentService.open(other.id, access)).rejects.toMatchObject({ status: 401 });
    await ReferralService.cancel(referral.id, "other");
    await expect(AttachmentService.open(ecg.id, access)).rejects.toMatchObject({ status: 401 });
    await db.query(`update referrals set status = 'confirmed' where id = $1`, [referral.id]);
    clock.advance(25 * 3600);
    await expect(AttachmentService.open(ecg.id, access)).rejects.toMatchObject({ status: 401 });
  });
});

describe("the routes", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const upload = (id: string, parts: { file?: Uint8Array; kind?: string }, headers: Record<string, string> = { "x-haazir-upload": "1" }) => {
    const form = new FormData();
    if (parts.kind !== undefined) form.set("kind", parts.kind);
    if (parts.file) form.set("file", new File([parts.file as BlobPart], "chart.jpg", { type: "image/jpeg" }));
    return attachmentsRoute.POST(new Request(`${BASE}/api/referrals/${id}/attachments`, { method: "POST", headers, body: form }), ctx(id));
  };

  it("uploads with the console header, refuses without it, and validates the form", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const ok = await upload(referral.id, { file: JPEG, kind: "photo" });
    expect(ok.status).toBe(201);
    expect(Object.keys((await ok.json()).attachment)).not.toContain("data");
    expect((await upload(referral.id, { file: JPEG, kind: "photo" }, {})).status).toBe(400);
    expect((await upload(referral.id, { file: JPEG, kind: "selfie" })).status).toBe(422);
    expect((await upload(referral.id, { kind: "photo" })).status).toBe(422);
    expect((await upload(referral.id, { file: HTML, kind: "photo" })).status).toBe(422);
    const tooBig = new Uint8Array(MAX_ATTACHMENT_BYTES + 100);
    tooBig.set(JPEG);
    expect((await upload(referral.id, { file: tooBig, kind: "photo" }, { "x-haazir-upload": "1", "content-length": String(tooBig.byteLength + 200) })).status).toBe(422);
  });

  it("serves the bytes as something a browser shows and never runs, to a session or a valid link only", async () => {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const meta = await AttachmentService.upload(referral, "photo", JPEG, null);
    const get = (query = "") => fileRoute.GET(new Request(`${BASE}/api/attachments/${meta.id}/file${query}`), ctx(meta.id));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(JPEG))).toBe(true);
    // With a passcode set and no cookie there is no session: the file needs a link, and the referral has no confirmed bed.
    vi.stubEnv("DEMO_PASSCODE", "open-sesame");
    expect((await get()).status).toBe(401);
    const exp = Math.floor(clock.now.getTime() / 1000) + 3600;
    expect((await get(`?exp=${exp}&sig=${signLink(meta.id, exp, SECRET)}`)).status).toBe(401);
    expect((await fileRoute.GET(new Request(`${BASE}/api/attachments/not-an-id/file`), ctx("not-an-id"))).status).toBe(404);
  });
});

describe("time to treatment", () => {
  it("refuses to record before a bed is confirmed", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await expect(ReferralService.recordTreatmentStarted(referral)).rejects.toMatchObject({ code: "NOT_RECORDABLE" });
  });

  it("is recorded once and shows as a median on Analytics", async () => {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    let selected = false;
    for (let t = 0; t <= 240; t++) {
      await advanceCalls(referral.id);
      await EvaluationService.evaluate(referral.id);
      const cur = await ReferralRepository.get(referral.id);
      if (!selected && cur!.status === "options_ready" && t >= 45) {
        const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.facility_id === IDS.tamarind && x.purpose === "availability")!;
        await HoldService.select(referral.id, a.id);
        selected = true;
      }
      clock.advance(1);
    }
    const confirmed = (await ReferralRepository.get(referral.id))!;
    expect(confirmed.status).toBe("confirmed");
    expect((await AnalyticsService.proofStats(DEFAULT_ORG_ID, false)).median_to_treatment_s).toBeNull();
    const first = await ReferralService.recordTreatmentStarted(confirmed);
    expect(first.treatment_started_at).not.toBeNull();
    clock.advance(600);
    const again = await ReferralService.recordTreatmentStarted(confirmed);
    expect(new Date(again.treatment_started_at!).getTime()).toBe(new Date(first.treatment_started_at!).getTime());
    expect(await db.query(`select 1 from events where referral_id = $1 and type = 'treatment_started'`, [confirmed.id])).toHaveLength(1);
    const stats = await AnalyticsService.proofStats(DEFAULT_ORG_ID, false);
    expect(stats.treated).toBe(1);
    expect(stats.median_to_bed_s).toBeGreaterThan(0);
    expect(stats.median_to_treatment_s!).toBeGreaterThanOrEqual(stats.median_to_bed_s!);
  });
});
