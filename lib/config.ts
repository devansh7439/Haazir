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

// Missed-webhook recovery: an attempt is stale when its status hasn't moved for this long; poll at most every POLL_EVERY_S.
export const STALE_AFTER_S: Record<string, number> = { queued: 60, dialing: 60, ringing: 90, in_progress: 240, wrapping_up: 45 };
export const POLL_EVERY_S = 30;
export const LOST_TRACK_AFTER_S = 15 * 60;
export const DEFAULT_RETENTION_DAYS = 30;
/** Bolna's documented source IPs for webhooks and function calls. */
export const BOLNA_IPS = ["13.203.39.153", "13.126.9.249", "13.202.133.53"];

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
  get authMode() { return (str("AUTH_MODE") || "passcode") as "passcode" | "users"; },
  get sessionSecret() { return str("SESSION_SECRET"); },
  get supabaseJwtSecret() { return str("SUPABASE_JWT_SECRET"); },
  get cronSecret() { return str("CRON_SECRET"); },
  get retentionDays() { return Number(str("RETENTION_DAYS")) || DEFAULT_RETENTION_DAYS; },
  get bolnaIpAllowlist() { return ["on", "true", "1"].includes(str("BOLNA_IP_ALLOWLIST").toLowerCase()); },
  get bolnaExtraIps() { return str("BOLNA_EXTRA_IPS").split(",").map((x) => x.trim()).filter(Boolean); },
  get metaAppSecret() { return str("META_APP_SECRET"); },
  get metaVerifyToken() { return str("META_WA_VERIFY_TOKEN"); },
  metaTemplate(key: "prearrival" | "doctor" | "family" | "bed_request"): string {
    return str(`META_WA_TEMPLATE_${key.toUpperCase()}`);
  },
  get sarvamApiKey() { return str("SARVAM_API_KEY"); },
  get sarvamSttModel() { return str("SARVAM_STT_MODEL") || "saarika:v2.5"; },
  get aapatSetuUrl() { return str("AAPAT_SETU_URL"); },
  maxEtaMinutes(acuity: string): number {
    return Number(str(acuity === "critical" ? "MAX_ETA_CRITICAL_MIN" : acuity === "serious" ? "MAX_ETA_SERIOUS_MIN" : "MAX_ETA_STABLE_MIN")) || 0;
  },
  get whatsappAvailabilityPing() { return ["on", "true", "1"].includes(str("WHATSAPP_AVAILABILITY_PING").toLowerCase()); },
  get missedCallSecret() { return str("MISSED_CALL_SECRET"); },
  get familyCalls() { return str("FAMILY_CALLS").toLowerCase() !== "off"; },
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
