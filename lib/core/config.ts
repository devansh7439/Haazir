// Orchestration constants (docs/02-architecture.md §6.1) and server env access.

export const WAVE_SIZE = 6;
export const WAVE_TIMEOUT_S = 150;
export const MAX_WAVES = 2;
export const HOLD_BUFFER_MIN = 30;
export const CALLBACK_MAX_MIN = 10;
export const BUSY_REDIAL_AFTER_S = 45;
export const MAX_REDIALS_PER_FACILITY = 2;
export const DEFAULT_RADIUS_KM = 40;
export const TICK_INTERVAL_MS = 5000;
export const TIMEZONE = "Asia/Kolkata";
/** Longest a hold call waits for the accepting call to end before dialling anyway. */
export const HOLD_WAIT_MAX_S = 90;
/** When the doctor records "call back later" from their own call, Haazir calls back after this long. */
export const MANUAL_CALLBACK_MIN = 5;
/** At most one family update call this often. */
export const FAMILY_CALL_GAP_MIN = 10;
/** The arrival check calls the chosen hospital this long after the patient was due (the ETA from confirmation). */
export const ARRIVAL_CHECK_AFTER_MIN = 10;
/** The bridge number connects a transferred call to the doctor of the referral that rang this number within this long. */
export const BRIDGE_MATCH_WINDOW_MIN = 10;
/** Live referrals count toward the per-organisation cap for this long after they start. */
export const ACTIVE_LIVE_WINDOW_H = 2;
/** "We're full" from a hospital's desk screen skips it in new searches this long, unless the desk picks another time (max 12 h). */
export const HOSPITAL_FULL_HOURS = 4;
export const HOSPITAL_FULL_MAX_HOURS = 12;
/** Night, India time: from this hour to the morning hour. A hospital whose needed service is day-only ranks lower then. */
export const NIGHT_FROM_HOUR = 20;
export const NIGHT_TO_HOUR = 8;
export const NIGHT_DAY_ONLY_PENALTY = 0.15;
/** The desk screen lists the calls the hospital took in the last this many hours. */
export const DESK_WINDOW_H = 12;
/** An inbound call is matched to the latest call Haazir placed to that number within this window. */
export const INBOUND_MATCH_WINDOW_MIN = 120;

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
  get databaseUrl() { return str("DATABASE_URL") || "pglite:./.data/pglite"; },
  get bolnaApiKey() { return str("BOLNA_API_KEY"); },
  get bolnaBaseUrl() { return str("BOLNA_BASE_URL") || "https://api.bolna.ai"; },
  get bolnaFromNumber() { return str("BOLNA_FROM_NUMBER"); },
  get bolnaWebhookSecret() { return str("BOLNA_WEBHOOK_SECRET"); },
  get bolnaFunctionSecret() { return str("BOLNA_FUNCTION_SECRET"); },
  get expoPushUrl() { return str("EXPO_PUSH_URL") || "https://exp.host/--/api/v2/push/send"; },
  get expoAccessToken() { return str("EXPO_ACCESS_TOKEN"); },
  get whatsappProvider() { return (str("WHATSAPP_PROVIDER") || "none") as "none" | "meta" | "twilio"; },
  get metaToken() { return str("META_WA_TOKEN"); },
  get metaPhoneNumberId() { return str("META_WA_PHONE_NUMBER_ID"); },
  get metaGraphVersion() { return str("META_GRAPH_VERSION"); },
  get twilioSid() { return str("TWILIO_ACCOUNT_SID"); },
  get twilioToken() { return str("TWILIO_AUTH_TOKEN"); },
  get twilioFrom() { return str("TWILIO_WHATSAPP_FROM"); },
  /** Text messages to the referring doctor for the events push also covers. "none" (the default) sends nothing. */
  get smsProvider() { return (str("SMS_PROVIDER") || "none") as "none" | "twilio"; },
  get twilioSmsFrom() { return str("TWILIO_SMS_FROM"); },
  get authMode() { return (str("AUTH_MODE") || "passcode") as "passcode" | "users"; },
  get sessionSecret() { return str("SESSION_SECRET"); },
  get supabaseJwtSecret() { return str("SUPABASE_JWT_SECRET"); },
  get cronSecret() { return str("CRON_SECRET"); },
  /** Token the telephony provider's answer URL for the bridge number carries (?token=). */
  get bridgeSecret() { return str("BRIDGE_SECRET"); },
  get retentionDays() { return Number(str("RETENTION_DAYS")) || DEFAULT_RETENTION_DAYS; },
  get bolnaIpAllowlist() { return ["on", "true", "1"].includes(str("BOLNA_IP_ALLOWLIST").toLowerCase()); },
  get bolnaExtraIps() { return str("BOLNA_EXTRA_IPS").split(",").map((x) => x.trim()).filter(Boolean); },
  get metaAppSecret() { return str("META_APP_SECRET"); },
  get metaVerifyToken() { return str("META_WA_VERIFY_TOKEN"); },
  metaTemplate(key: "prearrival" | "doctor" | "family" | "bed_request"): string {
    return str(`META_WA_TEMPLATE_${key.toUpperCase()}`);
  },
  get googlePlacesKey() { return str("GOOGLE_PLACES_API_KEY"); },
  /** An OSRM-compatible server for road drive times; empty keeps the straight-line estimate. */
  get routingBaseUrl() { return str("ROUTING_BASE_URL"); },
  get sarvamApiKey() { return str("SARVAM_API_KEY"); },
  get sarvamSttModel() { return str("SARVAM_STT_MODEL") || "saarika:v2.5"; },
  get aapatSetuUrl() { return str("AAPAT_SETU_URL"); },
  maxEtaMinutes(acuity: string): number {
    const name = acuity === "critical" ? "MAX_ETA_CRITICAL_MIN" : acuity === "serious" ? "MAX_ETA_SERIOUS_MIN" : "MAX_ETA_STABLE_MIN";
    return Number(str(name)) || 0;
  },
  get whatsappAvailabilityPing() { return ["on", "true", "1"].includes(str("WHATSAPP_AVAILABILITY_PING").toLowerCase()); },
  get missedCallSecret() { return str("MISSED_CALL_SECRET"); },
  /** When on, only a doctor an admin has verified can place referrals. Off by default so demos and drills need no registration. */
  get requireVerifiedReferrer() { return ["on", "true", "1"].includes(str("REQUIRE_VERIFIED_REFERRER").toLowerCase()); },
  /**
   * Signs the expiring links that give the receiving hospital a referral's attachments (32 characters or more). Empty: files
   * are kept and the console can open them, but no link is sent to a hospital.
   */
  get attachmentLinkSecret() { const s = str("ATTACHMENT_LINK_SECRET"); return s.length >= 32 ? s : ""; },
  get familyCalls() { return str("FAMILY_CALLS").toLowerCase() !== "off"; },
  /** Live referrals placing calls at once per organisation, so a runaway client can't phone every hospital in town. */
  get maxActiveLiveReferrals() { return Number(str("MAX_ACTIVE_LIVE_REFERRALS")) || 10; },
  agentId(purpose: "availability" | "hold_confirm" | "release" | "family_update" | "arrival_check"): string {
    const key = {
      availability: "BOLNA_AGENT_ID_AVAILABILITY",
      hold_confirm: "BOLNA_AGENT_ID_HOLD_CONFIRM",
      release: "BOLNA_AGENT_ID_RELEASE",
      family_update: "BOLNA_AGENT_ID_FAMILY",
      arrival_check: "BOLNA_AGENT_ID_ARRIVAL",
    }[purpose];
    return str(key);
  },
};
