// Orchestration constants (docs/02-architecture.md §6.1) and server env access.

export const WAVE_SIZE = 6;
export const WAVE_TIMEOUT_S = 150;
export const MAX_WAVES = 2;
export const ACCEPT_TARGET = 2;
export const HOLD_BUFFER_MIN = 30;
export const CALLBACK_MAX_MIN = 10;
export const BUSY_REDIAL_AFTER_S = 45;
export const MAX_REDIALS_PER_FACILITY = 2;
export const ROAD_FACTOR = 1.4;
export const AVG_SPEED_KMPH = 30;
export const DEFAULT_RADIUS_KM = 40;
export const TICK_INTERVAL_MS = 5000;
export const TICK_INTERVAL_SIM_MS = 1000;
export const TIMEZONE = "Asia/Kolkata";

function str(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const env = {
  get appBaseUrl() { return str("APP_BASE_URL"); },
  get demoPasscode() { return str("DEMO_PASSCODE"); },
  get simulationMode() { return str("SIMULATION_MODE").toLowerCase() === "true"; },
  get databaseUrl() { return str("DATABASE_URL") || "pglite:./.data/pglite"; },
  get bolnaApiKey() { return str("BOLNA_API_KEY"); },
  get bolnaBaseUrl() { return str("BOLNA_BASE_URL") || "https://api.bolna.ai"; },
  get bolnaFromNumber() { return str("BOLNA_FROM_NUMBER"); },
  get bolnaWebhookSecret() { return str("BOLNA_WEBHOOK_SECRET"); },
  get bolnaFunctionSecret() { return str("BOLNA_FUNCTION_SECRET"); },
  get whatsappProvider() { return (str("WHATSAPP_PROVIDER") || "none") as "none" | "meta" | "twilio"; },
  get metaToken() { return str("META_WA_TOKEN"); },
  get metaPhoneNumberId() { return str("META_WA_PHONE_NUMBER_ID"); },
  get metaGraphVersion() { return str("META_GRAPH_VERSION"); },
  get twilioSid() { return str("TWILIO_ACCOUNT_SID"); },
  get twilioToken() { return str("TWILIO_AUTH_TOKEN"); },
  get twilioFrom() { return str("TWILIO_WHATSAPP_FROM"); },
  agentId(purpose: "availability" | "hold_confirm" | "release" | "family_update"): string {
    const key = {
      availability: "BOLNA_AGENT_ID_AVAILABILITY",
      hold_confirm: "BOLNA_AGENT_ID_HOLD_CONFIRM",
      release: "BOLNA_AGENT_ID_RELEASE",
      family_update: "BOLNA_AGENT_ID_FAMILY",
    }[purpose];
    return str(key);
  },
};
