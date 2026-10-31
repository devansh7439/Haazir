import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readInbound } from "@/lib/integrations/whatsapp/whatsapp.inbound";

const secrets = { appBaseUrl: "https://app.test/", twilioToken: "tw-token", metaAppSecret: "meta-secret" };
const meta = (raw: string, sig?: string) => ({
  raw,
  contentType: "application/json",
  url: "https://app.test/api/whatsapp/inbound",
  headers: new Headers(sig ? { "x-hub-signature-256": sig } : {}),
});

describe("readInbound", () => {
  it("refuses a Meta request without a valid signature", () => {
    expect(readInbound(meta("{}"), secrets)).toEqual({ ok: false });
    expect(readInbound(meta("{}", "sha256=bad"), secrets)).toEqual({ ok: false });
  });

  it("accepts a signed Meta request, and gives no messages for unreadable JSON", () => {
    const sign = (raw: string) => "sha256=" + createHmac("sha256", secrets.metaAppSecret).update(raw).digest("hex");
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: "919800000101", text: { body: "yes R-1234" } }] } }] }] });
    expect(readInbound(meta(body, sign(body)), secrets)).toMatchObject({ ok: true, provider: "meta", messages: [{ from: "+919800000101", text: "yes R-1234" }] });
    expect(readInbound(meta("not json", sign("not json")), secrets)).toEqual({ ok: true, provider: "meta", messages: [] });
  });

  it("treats a form body as Twilio and checks its signature against the public URL", () => {
    const raw = "From=whatsapp%3A%2B919800000101&Body=yes";
    const params = { From: "whatsapp:+919800000101", Body: "yes" };
    const url = "https://app.test/api/whatsapp/inbound";
    const sig = createHmac("sha1", secrets.twilioToken).update(url + Object.keys(params).sort().map((k) => k + params[k as keyof typeof params]).join("")).digest("base64");
    const req = (s: string) => ({ raw, contentType: "application/x-www-form-urlencoded", url, headers: new Headers({ "x-twilio-signature": s }) });
    expect(readInbound(req(sig), secrets)).toMatchObject({ ok: true, provider: "twilio", messages: [{ from: "+919800000101", text: "yes" }] });
    expect(readInbound(req("wrong"), secrets)).toEqual({ ok: false });
  });
});
