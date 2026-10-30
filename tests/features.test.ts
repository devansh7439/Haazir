import fs from "node:fs";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAgent, parsePromptDoc, type ToolDef } from "@/lib/bolnaAgents";
import { signSession, verifySession } from "@/lib/gate";
import { parseIntake } from "@/lib/intakeParse";
import { applyEtaCap } from "@/lib/matching";
import { bedRequestMessage, preArrivalNote, templateParam, type HandoffFacts } from "@/lib/messages";
import { hashPassword, verifyPassword } from "@/lib/password";
import { portalMismatch } from "@/lib/portalCheck";
import { parseQuickReply } from "@/lib/quickReply";
import { metaPayload } from "@/lib/whatsapp";
import { parseMetaPayload, parseTwilioPayload, verifyMetaSignature, verifyTwilioSignature } from "@/lib/whatsappInbound";

afterEach(() => vi.unstubAllEnvs());

const TEMPLATES = [
  { case_type: "snakebite_neuro", default_capabilities: ["icu_bed", "ventilator"] },
  { case_type: "stemi", default_capabilities: ["cath_lab_24x7", "cardiologist", "icu_bed"] },
];

describe("WhatsApp quick replies (C6)", () => {
  it("reads yes/no with a reference and an optional condition", () => {
    expect(parseQuickReply("YES R-4821")).toEqual({ answer: "yes", code: "R-4821", condition: null });
    expect(parseQuickReply("haan 4821 send the case sheet")).toEqual({ answer: "yes", code: "R-4821", condition: "send the case sheet" });
    expect(parseQuickReply("no r4821 ICU full")).toEqual({ answer: "no", code: "R-4821", condition: "ICU full" });
    expect(parseQuickReply("yes")).toEqual({ answer: "yes", code: null, condition: null });
  });
  it("never turns an ambiguous message into an answer", () => {
    expect(parseQuickReply("who is this?")).toBeNull();
    expect(parseQuickReply("yes but no ventilator")).toBeNull();
    expect(parseQuickReply("dekhte hain")).toBeNull();
  });
});

describe("WhatsApp intake parser (C2)", () => {
  it("fills the form from a typical message", () => {
    const p = parseIntake("34 yr male, krait bite 2 hrs ago, ptosis, critical. Given 10 vials ASV", TEMPLATES);
    expect(p.case_type).toBe("snakebite_neuro");
    expect(p.required_capabilities).toEqual(["icu_bed", "ventilator"]);
    expect(p.acuity).toBe("critical");
    expect(p.age_value).toBe(34);
    expect(p.sex).toBe("male");
    expect(p.note).toContain("krait bite");
  });
  it("drops the note when it may hold a name or number", () => {
    expect(parseIntake("chest pain 60/F, son's number 9845012345", TEMPLATES)).toMatchObject({ case_type: "stemi", note: null, note_dropped: true, sex: "female", age_value: 60 });
    expect(parseIntake("Mr. Ramesh, snake bite, serious", TEMPLATES)).toMatchObject({ note: null, note_dropped: true, acuity: "serious" });
  });
  it("leaves unknown cases empty for the doctor", () => {
    expect(parseIntake("please call me", TEMPLATES)).toMatchObject({ case_type: null, required_capabilities: [], matched: [] });
  });
});

describe("portal vs desk (C4)", () => {
  it("flags a decline when the portal shows free beds or ventilators", () => {
    expect(portalMismatch("declined", "full: ICU full", { icu_beds_free: 3, ventilators_free: 0 })).toBe("portal showed 3 ICU beds free");
    expect(portalMismatch("declined", "no_ventilator: none free", { icu_beds_free: 0, ventilators_free: 1 })).toBe("portal showed 1 ventilator free");
    expect(portalMismatch("declined", "no_specialist", { icu_beds_free: 2, ventilators_free: 2 })).toBeNull();
  });
  it("flags an acceptance when the portal shows no ICU beds", () => {
    expect(portalMismatch("accepted", null, { icu_beds_free: 0, ventilators_free: null })).toBe("portal showed no ICU beds free");
    expect(portalMismatch("accepted", null, { icu_beds_free: null, ventilators_free: null })).toBeNull();
  });
});

describe("max ETA by acuity (C8)", () => {
  const ranked = [{ eta_minutes: 18 }, { eta_minutes: 55 }, { eta_minutes: 74 }];
  it("skips far hospitals only when nearer ones exist", () => {
    expect(applyEtaCap(ranked, 60)).toEqual({ kept: [{ eta_minutes: 18 }, { eta_minutes: 55 }], skipped: 1 });
    expect(applyEtaCap([{ eta_minutes: 80 }], 60)).toEqual({ kept: [{ eta_minutes: 80 }], skipped: 0 });
    expect(applyEtaCap(ranked, 0).skipped).toBe(0);
  });
});

describe("Meta templates", () => {
  const facts: HandoffFacts = {
    code: "R-4821", doctor_name: "Dr. Meera Rao", doctor_phone: "+919800000201", referring_facility: "Hoskote PHC",
    patient_name: "Ramesh K.", who: "Man aged 34", case_label: "Snakebite", acuity: "critical", note: "line one\nline two",
    needs_labels: ["ICU bed", "Ventilator"], eta_minutes: 18, transport: "ambulance", contact_person: null, confirmed_time: "02:19",
    hospital_name: "Tamarind", hospital_address: null, hospital_lat: 13, hospital_lng: 77, desk_number: "+919800000103",
    bed_type: "icu_with_ventilator", conditions: null, hold_until_time: "03:02", aapat_setu_url: "https://example.org/R-4821",
  };
  it("produces parameters Meta accepts (no blanks, no newlines)", () => {
    const t = preArrivalNote(facts).template!;
    expect(t.params).toHaveLength(9);
    expect(t.params.every((p) => p.length > 0 && !/[\n\t]/.test(p))).toBe(true);
    expect(t.params[3]).toBe("line one · line two");
    expect(t.params[6]).toBe("—");
    expect(templateParam("  a    b  ")).toBe("a b");
  });
  it("adds the Aapat Setu link (C7) only to the pre-arrival note", () => {
    expect(preArrivalNote(facts).body).toContain("Aapat Setu: https://example.org/R-4821");
    expect(preArrivalNote({ ...facts, aapat_setu_url: null }).body).not.toContain("Aapat Setu");
  });
  it("sends a template when one is configured, plain text otherwise", () => {
    const r = bedRequestMessage({ code: "R-4821", doctor_name: "Dr. Rao", referring_facility: "Hoskote PHC", case_summary: "Man aged 34." });
    expect(metaPayload("+919800000103", r)).toMatchObject({ to: "919800000103", type: "text" });
    vi.stubEnv("META_WA_TEMPLATE_BED_REQUEST", "haazir_bed_request");
    expect(metaPayload("+919800000103", r)).toMatchObject({
      type: "template",
      template: { name: "haazir_bed_request", language: { code: "en" }, components: [{ type: "body" }] },
    });
  });
});

describe("sessions and passwords", () => {
  const secret = "x".repeat(40);
  it("round-trips a signed session and rejects tampering or a short secret", async () => {
    const token = await signSession({ uid: "u1", org: "o1", role: "admin", rid: null, name: "A", email: "a@b.c" }, secret);
    expect(await verifySession(token, secret)).toMatchObject({ uid: "u1", org: "o1", role: "admin" });
    expect(await verifySession(token, "y".repeat(40))).toBeNull();
    expect(await verifySession(token + "x", secret)).toBeNull();
    await expect(signSession({ uid: "u", org: "o", role: "doctor", rid: null, name: "", email: "" }, "short")).rejects.toThrow();
  });
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong password!", h)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
});

describe("inbound WhatsApp parsing and signatures", () => {
  it("verifies Meta and Twilio signatures", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "appsecret").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "appsecret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    const params = { Body: "YES R-4821", From: "whatsapp:+919800000103" };
    const url = "https://app.example/api/whatsapp/inbound";
    const tsig = createHmac("sha1", "tok").update(url + "Body" + params.Body + "From" + params.From).digest("base64");
    expect(verifyTwilioSignature(url, params, tsig, "tok")).toBe(true);
    expect(verifyTwilioSignature(url, { ...params, Body: "NO" }, tsig, "tok")).toBe(false);
  });
  it("extracts messages from both providers", () => {
    expect(parseTwilioPayload({ From: "whatsapp:+919800000103", Body: "YES" })).toEqual([{ from: "+919800000103", text: "YES", audio: null }]);
    const meta = { entry: [{ changes: [{ value: { messages: [{ from: "919800000201", type: "audio", audio: { id: "m1" } }] } }] }] };
    expect(parseMetaPayload(meta)).toEqual([{ from: "+919800000201", text: null, audio: { provider: "meta", id: "m1" } }]);
  });
});

describe("Bolna agent builder", () => {
  it("builds every agent from the prompt files with tools wired to our routes", () => {
    for (const key of ["availability", "hold-confirm", "release", "family-update", "inbound-callback"]) {
      const doc = parsePromptDoc(key, fs.readFileSync(`bolna/prompts/${key}.md`, "utf8"));
      expect(doc.systemPrompt.length).toBeGreaterThan(100);
      const tools = doc.toolFiles.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as ToolDef);
      const agent = buildAgent(doc, tools, {
        appUrl: "https://app.example", webhookSecret: "wh", functionSecret: "fn", llmProvider: "openai", llmModel: "m",
        sttProvider: "sarvam", sttModel: "s", ttsProvider: "sarvam", ttsModel: "t", ttsVoice: "v", telephony: "plivo", startLanguage: "en", suffix: "",
      }) as { agent_config: { webhook_url: string; tasks: Array<{ tools_config: { api_tools?: { tools_params: Record<string, { url: string; api_token: string }> } }; toolchain: { pipelines: string[][] } }> } };
      expect(agent.agent_config.webhook_url).toBe("https://app.example/api/bolna/webhook?token=wh");
      expect(Array.isArray(agent.agent_config.tasks[0].toolchain.pipelines[0])).toBe(true);
      for (const p of Object.values(agent.agent_config.tasks[0].tools_config.api_tools?.tools_params ?? {})) {
        expect(p.url).toMatch(/^https:\/\/app\.example\/api\/bolna\/functions\//);
        expect(p.api_token).toBe("Bearer fn");
      }
    }
    const avail = parsePromptDoc("availability", fs.readFileSync("bolna/prompts/availability.md", "utf8"));
    expect(avail.toolFiles).toHaveLength(3);
    expect(Object.keys(avail.welcome).sort()).toEqual(["en", "hi", "kn"]);
  });
});
