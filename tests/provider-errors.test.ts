import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SmsClient } from "@/lib/integrations/sms/sms.client";
import { WhatsAppClient } from "@/lib/integrations/whatsapp/whatsapp.client";

// A provider's error text can quote the number it was asked to reach; it must never come back unmasked (CLAUDE.md rule 1).

const NUMBER = "+919845012345";
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("SMS_PROVIDER", "twilio");
  vi.stubEnv("WHATSAPP_PROVIDER", "twilio");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret");
  vi.stubEnv("TWILIO_SMS_FROM", "+15550001111");
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "whatsapp:+15550002222");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SmsClient.deliver", () => {
  it("masks a number quoted in the provider's error", async () => {
    vi.stubGlobal("fetch", reply(400, { message: `The 'To' number ${NUMBER} is not a valid phone number` }));
    const result = await SmsClient.deliver(NUMBER, "hello");
    expect(result.status).toBe("failed");
    expect(result.error).not.toContain("9845012345");
    expect(result.error).toContain("is not a valid phone number");
  });

  it("masks a number in a thrown network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error(`connect failed for ${NUMBER}`); }));
    expect((await SmsClient.deliver(NUMBER, "hello")).error).not.toContain("9845012345");
  });

  it("falls back to the HTTP status when the answer is not JSON text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    expect((await SmsClient.deliver(NUMBER, "hello")).error).toBe("HTTP 502");
  });

  it("reports sent for a 2xx answer", async () => {
    vi.stubGlobal("fetch", reply(201, { sid: "SM1" }));
    expect(await SmsClient.deliver(NUMBER, "hello")).toEqual({ status: "sent", provider: "twilio", error: null });
  });
});

describe("WhatsAppClient.deliver", () => {
  it("masks a number quoted in the provider's error", async () => {
    vi.stubGlobal("fetch", reply(400, { message: `Unable to deliver to ${NUMBER}` }));
    const result = await WhatsAppClient.deliver(NUMBER, { body: "hello" });
    expect(result.status).toBe("failed");
    expect(result.error).not.toContain("9845012345");
  });

  it("returns the provider's message id on success", async () => {
    vi.stubGlobal("fetch", reply(201, { sid: "SM9" }));
    expect((await WhatsAppClient.deliver(NUMBER, { body: "hello" })).provider_message_id).toBe("SM9");
  });
});
