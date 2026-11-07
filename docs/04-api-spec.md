# 04 · API Specification

All routes are Next.js route handlers under `/api`. JSON in and out. Validate every body with zod.
Console routes sit behind the passcode middleware in the MVP. Bolna routes use their own secrets (§3).

---

## 1. Conventions

- **IDs** are UUIDs. **Phone numbers** are E.164 (`+91…`). Indian 10-digit input is normalised to `+91` server-side.
- **Errors** look like `{ "error": { "code": "NOTE_CONTAINS_IDENTIFIER", "message": "…", "details": {…} } }`.
- **Idempotency:** `tick`, the webhook and all function routes are safe to call repeatedly.
- **Privacy:** no route returns `patient_details` or message bodies to the browser.

---

## 2. Console API

### 2.1 `POST /api/referrals/preview`
Builds the spoken summary and lists eligible hospitals **without creating anything**. Powers the "what hospitals will hear" preview.

```jsonc
// request: same body as 2.2, without "patient"
// 200
{
  "spoken_summary": "Man aged 34, suspected snakebite with neurotoxic signs, critical. Drooping eyelids and trouble swallowing 2 hours after bite. Given 10 vials of anti-snake venom. Needs an ICU bed and a ventilator.",
  "warnings": [],
  "eligible": [
    { "facility_id": "00000000-0000-4000-8000-000000000103", "name": "Tamarind District Hospital (Demo)", "distance_km": 6.4, "eta_minutes": 18, "call_language": "kn", "rank_reasons": ["18 min away", "has ICU bed + ventilator"] }
  ]
}
```

### 2.2 `POST /api/referrals`
Creates the referral and dispatches wave 1.

```jsonc
// request
{
  "referrer_id": "00000000-0000-4000-8000-000000000201",
  "case_type": "snakebite_neuro",
  "required_capabilities": ["icu_bed", "ventilator"],
  "acuity": "critical",
  "age_value": 34,
  "age_unit": "years",
  "sex": "male",
  "note": "Drooping eyelids and trouble swallowing 2 hrs after bite. Given 10 vials of ASV.",
  "transport": "ambulance",
  "search_radius_km": 40,
  // Optional clinical facts. None identify the patient. airway/spo2/gcs/on_oxygen are read to every desk; payer and
  // medico_legal are only told to a desk that asks. Defaults: "unknown" / null.
  "airway": "intubated",          // intubated | own | unknown
  "spo2": 88,                     // 0–100
  "gcs": 9,                       // 3–15
  "on_oxygen": true,
  "payer": "pmjay",               // free_govt | pmjay | insurance | cash | unknown
  "medico_legal": false,
  // Optional handover (migration 0014). None identify the patient. pregnancy_weeks, trauma_mechanism, infectious_risk and
  // blood_needed are read to every desk; treatment_given and blood_group are only told to a desk that asks.
  // treatment_given gets the same identifier check as note (422 TREATMENT_CONTAINS_IDENTIFIER). pregnancy_weeks with sex
  // "male" is 422 PREGNANCY_NOT_APPLICABLE.
  "pregnancy_weeks": 34,          // 1–45
  "trauma_mechanism": "road_accident", // not_trauma | road_accident | fall | assault | burn | penetrating | other | unknown
  "infectious_risk": "airborne",  // none | airborne | contact | bloodborne | unknown
  "treatment_given": "IV fluids, tetanus toxoid", // up to 160 characters
  "blood_group": "B-",            // A+ A- B+ B- AB+ AB- O+ O- | unknown
  "blood_needed": true,
  // Optional consent to the transfer itself (migration 0015); the time is set when the referral is created.
  "transfer_consent": "attendant", // patient | attendant | emergency_waiver
  "transfer_reason": "service_not_available", // service_not_available | needs_higher_care | no_bed | other
  "patient": {
    "patient_name": "Ramesh K.",
    "attendant_name": "Lakshmi",
    "attendant_phone": "+919800000301",
    "attendant_language": "kn"
  }
}
```

```jsonc
// 201
{
  "id": "4f0c2a8e-…",
  "code": "R-4821",
  "status": "searching",
  "wave": 1,
  "attempts": [
    { "id": "a1…", "facility_id": "…0103", "facility_name": "Tamarind District Hospital (Demo)", "rank": 1, "eta_minutes": 18, "distance_km": 6.4, "call_language": "kn", "status": "queued", "rank_reasons": ["18 min away", "has ICU bed + ventilator"] }
  ]
}
```

| Rule | Detail |
|---|---|
| Required | `referrer_id`, `case_type`, `acuity`, `required_capabilities` (can be empty only for `other`) |
| Bolna not configured | 422 `BOLNA_NOT_CONFIGURED` when `BOLNA_API_KEY` or `BOLNA_AGENT_ID_AVAILABILITY` is missing |
| `note` | 160 characters max. **Rejected** (422 `NOTE_CONTAINS_IDENTIFIER`) if it has 9 or more consecutive digits, an Aadhaar-like pattern, or an email. **Warned** for honorific + capitalised word |
| No eligible hospitals | 409 `NO_ELIGIBLE_FACILITIES` with `suggestions: ["widen radius to 80 km", "remove: neurosurgeon"]` |
| Partial dispatch failure | Still 201. The failed attempts have `status: "failed"`, and an event records the Bolna error |
| Side effects | Insert `referrals` and `patient_details`; atomic claim of wave 1; insert attempts; call Bolna in parallel; events `referral_created`, `wave_dispatched`, `call_queued` × N |

### 2.3 `GET /api/referrals/:id`
Returns the referral (no identifiers), attempts joined with facility name, coordinates, ETA and contact role, the latest 200 events, and message **previews** (`{audience, to_masked, status, preview_redacted}`).

`nearest_ed` is empty unless the referral is `exhausted`; then it holds up to 3 `{facility_id, name, kind, distance_km, eta_minutes, phone}`: the closest CHC, district, medical-college or private hospitals (not the origin) with an active, non-IVR `casualty_desk` number, whatever they can do, so the doctor can stabilise the patient there. `eta_minutes` is the straight-line estimate (× 1.4 at 30 km/h), not a road time.

### 2.4 `POST /api/referrals/:id/select`
```jsonc
// request
{ "attempt_id": "a1…", "force": false }
// 202
{ "status": "confirming", "hold_attempt_id": "h9…" }
```
409 if the referral isn't `options_ready`, if the attempt isn't `accepted`/`conditional`, or if it's `needs_review` (unless `force: true`, which the UI only offers after the doctor listens to the recording).
Side effects: dispatch the **hold-confirm** call to the same contact; event `facility_selected`.

### 2.5 `POST /api/referrals/:id/confirm-manually`
For when the doctor already spoke to the hospital. `{ "attempt_id": "a1…", "contact_person": "Dr Kiran" }` → `confirmed`, then the same handoff and releases as a confirmed hold.

### 2.6 `POST /api/referrals/:id/cancel`
`{ "reason": "patient stabilised" }` → `cancelled`. Calls still `queued` are stopped with Bolna `POST /call/{execution_id}/stop`, which only works on queued or scheduled calls. Ringing and in-progress calls finish naturally, and any hospital that accepted gets a release call.

### 2.7 `POST /api/referrals/:id/close`
`{ "reason": "arrived" | "hold_expired" | "transferred_elsewhere" | "other", "note": "…" }` → `closed`.

### 2.7a `POST /api/referrals/:id/transfer-consent`
`{ "transfer_consent": "patient" | "attendant" | "emergency_waiver", "transfer_reason"?: … }` records, or corrects, who agreed to the transfer; the time is the moment of recording and an omitted reason keeps the one on file. → `{ transfer_consent, transfer_consent_at, transfer_reason }`. 409 `NOT_RECORDABLE` once the referral is cancelled. Writes the audit event `transfer_consent_recorded`.

### 2.7b `GET /api/referrals/:id/slip`
The referral slip (transfer record) once a hospital has confirmed the bed: `{ slip: { code, confirmed_at, hold_until, from, to, reason, consent, sbar, lines } }`. `lines` is the same slip as plain text for pasting into a case sheet. It holds no patient name or phone. 409 `NO_DESTINATION` before a bed is confirmed.

### 2.7d `POST /api/referrals/:id/ambulance`
`{ "status": "requested" | "dispatched" | "at_patient" | "not_available" | "not_requested" }` records where the ambulance is, as the doctor last set it. Haazir does not book the ambulance (there is no public 108 dispatch API): the doctor calls 108 or the hospital and taps the state. → `{ ambulance_status, ambulance_updated_at }`. 409 `NOT_RECORDABLE` once the referral is cancelled or closed. Writes the audit event `ambulance_status`. The slip prints it.

### 2.7e Attachments (ECG, photos, records)
- `POST /api/referrals/:id/attachments` is `multipart/form-data` with `kind` (`ecg | photo | record | other`) and `file`, and needs the header `x-haazir-upload: 1` (a cross-site form can't set it; 400 `UPLOAD_HEADER_MISSING` without). JPEG, PNG, WebP or PDF, recognised from the file's first bytes, not from what the browser claims; up to 4 MB; at most 6 per referral. 422 `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`, `EMPTY_FILE`, `TOO_MANY_ATTACHMENTS`; 409 `NOT_ATTACHABLE` once the referral is cancelled or closed. → 201 `{ attachment: { id, kind, content_type, size_bytes, created_at } }`. No filename is stored.
- `GET /api/referrals/:id/attachments` → `{ attachments: [...metadata], hospital_links: [{ label, url }] }`. `hospital_links` is empty until a bed is confirmed, and always empty without `ATTACHMENT_LINK_SECRET` (32+ characters) and `APP_BASE_URL`.
- `DELETE /api/referrals/:id/attachments/:attachmentId`.
- `GET /api/attachments/:id/file` serves the bytes (`inline`, `nosniff`, a sandboxing CSP, `no-store`). It authenticates itself: a console session of the same organisation (404 otherwise), or the link given to the hospital, `?exp=<seconds>&sig=<hmac>`, which works for 24 hours while the referral has a confirmed bed and never after it is cancelled (401).
The files sit in `referral_attachments`, which no browser role can read. The pre-arrival WhatsApp note carries one `ECG: https://…` line per file (the Meta template parameters are unchanged, so a template-only send has no links; copy them from the console). The console's message preview says only how many files there are. A photo or record can show the patient's name, so the retention purge deletes attachments with the other identifiers.

### 2.7f `POST /api/referrals/:id/treatment-started`
Records that the receiving hospital began treating the patient: `{ treatment_started_at }`. Idempotent (the first record wins). 409 `NOT_RECORDABLE` until a bed is confirmed. Audit event `treatment_started`. Analytics shows the median from "Find a bed" to a confirmed bed and to treatment starting.

### 2.7c Doctor registration
- `POST /api/referrers/:id/registration` `{ "registration_no": "KA 12345", "registration_council": "NMC" }`. A doctor can send their own; an admin anyone's in the organisation. Tidies the number (upper case, no spaces; 3–32 of letters, digits, `/`, `.`, `-`), stores it and sets `verification_status` to `pending`. A changed number goes back to `pending`. 422 `INVALID_REGISTRATION`.
- `POST /api/referrers/:id/verification` (admin) `{ "decision": "verified" | "rejected" }`, after the admin looked the number up in the NMC Indian Medical Register or the state council's. 409 `NO_REGISTRATION` when the doctor gave none.
- `GET /api/referrers` (admin) lists the organisation's doctors with their registration and status, without phone numbers.
- With `REQUIRE_VERIFIED_REFERRER=on`, `POST /api/referrals` and the preview answer 422 `REFERRER_NOT_VERIFIED` for a doctor who is not `verified`. Off by default.
Nothing calls an outside register: the check is a person's.

### 2.8 `POST /api/referrals/:id/tick`
Runs `evaluateReferral` and re-reads stuck calls from Bolna. Called by the open console every 5 s.
```jsonc
// 200
{ "changed": true, "actions": ["wave_2_dispatched"], "status": "searching" }
```

### 2.9 `POST /api/attempts/:id/manual-outcome`
The doctor records what a desk told them on a direct call.
```json
{ "outcome": "accepted", "bed_type": "icu_with_ventilator", "ready_in_minutes": 20, "contact_person": "Sister Rekha", "conditions": "", "decline_reason": "" }
```
Sets `outcome_source = "manual"` and runs `evaluateReferral`.

### 2.10 `POST /api/attempts/:id/redial`
`{ "contact_id": "…" }` or `{ "to_number": "+91…" }` → new attempt with `parent_attempt_id`. Rate-limited to 2 redials per facility per referral.

### 2.11 Directory
| Route | Purpose |
|---|---|
| `GET /api/facilities?include=stats` | List with capabilities, contacts and `facility_stats` |
| `POST /api/facilities` | Create |
| `PATCH /api/facilities/:id` | Edit (name, location, `call_language`, `whatsapp_number`, `active`) |
| `PUT /api/facilities/:id/capabilities` | `{ "codes": ["icu_bed","ventilator"] }` replaces the static capabilities |
| `POST /api/facilities/:id/contacts` | `{ "role": "casualty_desk", "phone": "+91…", "priority": 1, "is_ivr": false }` |
| `PATCH /api/contacts/:id` | Edit or deactivate a number |

---

## 3. Bolna-facing routes

### 3.1 `POST /api/bolna/webhook?token=<BOLNA_WEBHOOK_SECRET>`

Configured per agent: **Extractions tab → Webhook URL**, all statuses **[B5]**. The body is the execution object **[B7]**. Fields we use:

| Field | Use |
|---|---|
| `id` | Execution ID → `call_attempts.bolna_execution_id` |
| `status` | Mapped to our status (`02-architecture.md` §5.3) |
| `termination_reason` | Stored; hints such as `voicemail_reached`, `inactivity_timeout` |
| `transcript` | Stored at `completed` |
| `telephony_data.recording_url` | Stored at `completed` |
| `telephony_data.hangup_reason`, `hangup_by` | Event payload |
| `extracted_data` | Stored; `Referral outcome → availability_outcome → objective` used for reconciliation |
| `context_details` | Contains the `user_data` we sent; fallback to find `attempt_id` |
| `answered_by_voice_mail` | Treated like `voicemail_reached` |
| `error_message` | Event payload on failures |

**Handler steps**
1. Check the token (401 if wrong).
2. Insert the raw body into `bolna_webhook_log`.
3. Find the attempt by `bolna_execution_id = body.id`. If not found, try `context_details` → `attempt_id`. If still not found, return 200 and log it.
4. Apply the status **only if it moves forward** (monotonic rule).
5. On `completed`: store final fields, reconcile the outcome (`02-architecture.md` §5.4), update contact stats.
6. Insert events (`call_ringing`, `call_answered`, `call_ended`, `needs_review`, …).
7. `evaluateReferral(referral_id)`.
8. Return `200 {"ok": true}` quickly. Keep heavy work short and never throw on bad payloads.

### 3.2 Function routes (called by Bolna mid-call)

**Auth:** `Authorization: Bearer <BOLNA_FUNCTION_SECRET>`, which the tool's `api_token` field sends **[B2]**.
**Body:** the tool's `param` object as JSON (POST) **[B3]**. Every value arrives as a string.
**Normalise:** trim; treat `""`, `"None"`, `"none"`, `"null"`, `"undefined"` and unreplaced tokens like `%(bed_type)s` as missing; parse numbers leniently ("fifteen" → 15 if you add a small word map, else null).
**Find the attempt:** `attempt_id`; fallback: the latest non-terminal attempt with the same `to_number`.
**Respond fast** (aim for under 500 ms; keep heavy work out of the request path). The JSON goes back to the agent's LLM, so `instruction` tells it what to say next. **If anything fails, still return 200** with a safe instruction, so the call doesn't break in front of a hospital.

#### `POST /api/bolna/functions/record-response`
```jsonc
// request (from the record_hospital_response tool)
{
  "attempt_id": "a1…",
  "outcome": "accepted",
  "bed_type": "icu_with_ventilator",
  "specialist_available": "yes",
  "needs_ready": "yes",          // asked after a yes: are the specialist and equipment here and working now? yes | no | unknown
  "unavailable_needs": "",       // only with needs_ready "no": what is missing, in a few words
  "ready_in_minutes": "15",
  "contact_person": "Dr Kiran",
  "conditions": "",
  "decline_reason": "",
  "alternate_number": "",
  "to_number": "+919800000103"
}
```

| `outcome` | Server action | `instruction` returned |
|---|---|---|
| `accepted` / `conditional` | Save details; set `first_acceptance_at` once; referral → `options_ready` | "Thank them, say Dr. Meera Rao's team will confirm within a few minutes if they send the patient, and end the call." |
| `accepted` with `needs_ready: "no"` | Recorded as `conditional`, with `conditions` starting "Not available right now: …" so the doctor sees what is missing before choosing. `unknown` changes nothing | as above |
| `declined` | Save `decline_reason` | "Thank them for their time and end the call." |
| `redirected` | Normalise `alternate_number`; if valid, create a redial attempt to it and add it as a contact (`role: other`, unverified) | "Thank them, say you will call that number now, and end the call." |
| `unclear` | Save | "Thank them and end the call." |

```jsonc
// 200
{ "result": "recorded", "instruction": "Thank them, say Dr. Meera Rao's team will confirm within a few minutes if they send the patient, and end the call." }
```

#### `POST /api/bolna/functions/request-doctor`
```jsonc
{ "attempt_id": "a5…", "reason": "wants to know if patient is intubated", "contact_person": "Dr Anil", "callback_number": "", "to_number": "+919800000105" }
```
Sets outcome `needs_doctor`; event `doctor_callback_requested` with `{facility_name, number: callback_number || to_number, reason}` (no patient data). The board shows a banner with `tel:` link.
→ `{ "result": "doctor_alerted", "instruction": "Tell them Dr. Meera Rao will call them back on this number within about two minutes, thank them, and end the call." }`

#### `POST /api/bolna/functions/request-callback`
```jsonc
{ "attempt_id": "a4…", "minutes": "3", "contact_person": "Nurse Priya", "to_number": "+919800000104" }
```
`callback_due_at = now + clamp(minutes, 1, CALLBACK_MAX_MIN)`; outcome `callback_later`.
→ `{ "result": "callback_scheduled", "instruction": "Say you will call back in about 3 minutes, thank them, and end the call." }`

#### `POST /api/bolna/functions/record-hold`
```jsonc
{ "attempt_id": "h9…", "confirmed": "yes", "contact_person": "Sister Rekha", "whatsapp_number": "", "notes": "", "to_number": "+919800000103" }
```

| `confirmed` | Server action |
|---|---|
| `yes` | Attempt `hold_confirmed`; referral → `confirmed`, `confirmed_at`, `hold_expires_at = now + eta + HOLD_BUFFER_MIN`; save `whatsapp_number` on the facility if given; send messages (§4); `evaluateReferral` dispatches releases |
| `no` | Attempt `hold_declined`; referral → `options_ready`; event; the doctor chooses again |

→ `{ "result": "recorded", "instruction": "Thank them, say the pre-arrival note is coming on WhatsApp, and end the call." }`

#### `POST /api/bolna/functions/record-arrival`
Called by the **arrival check** agent: the chosen hospital says whether the patient has reached it.
```jsonc
{ "attempt_id": "c3…", "arrived": "yes", "contact_person": "Sister Rekha", "to_number": "+919800000103" }
```

| `arrived` | Server action |
|---|---|
| `yes` | Attempt `arrival_confirmed`; event `arrival_confirmed` `{facility_id}` |
| `no` | Attempt `not_arrived`; event `not_arrived` `{facility_id}` |
| anything else | Nothing is recorded (CLAUDE.md rule 10); the call ends |

The route only accepts the id of an `arrival_check` call. It does not close the referral: the doctor still presses **Patient arrived**, so a desk's word is never the only record.
→ `{ "result": "recorded", "instruction": "Thank them and end the call." }`

#### `POST /api/bolna/functions/inbound-callback` (should-have S6)
Called by the **inbound** agent when a hospital rings our number back.
```json
{ "hospital_name": "Banyan", "referral_code": "R4821", "message": "we can take the patient now", "from_number": "+919800000101" }
```
Normalise the code (`R4821`, `R 4 8 2 1` → `R-4821`). Match the referral by code; otherwise by `from_number` against attempts dialled in the last 2 hours. Add an `inbound_callback` event, which shows a banner with a `tel:` link on the board.
→ `{ "result": "doctor_alerted", "instruction": "Tell them the referring doctor will call them back right away, thank them, and end the call." }`

---

## 4. Messages

Hospitals page extras: `POST /api/facilities` (admin) takes `capabilities` (codes) and `contacts` (up to 5 desk numbers) with the hospital and writes nothing if any is invalid. `GET /api/facilities/ratings` (any signed-in user) returns `{ enabled, ratings: { <facility id>: { rating, count, url } } }` from Google Places; `enabled` is false and `ratings` empty without `GOOGLE_PLACES_API_KEY`. Only the Google place id is stored (`facilities.google_place_id`); ratings are held in memory for an hour, as Google's terms don't allow storing them.

Sent by `WhatsAppService.send` (`lib/modules/handoff/whatsapp.service.ts`) with provider `meta`, `twilio` or `none`. With `none`, or if a send fails, the row is stored as `simulated` (meaning not sent) or `failed` and the UI shows the preview. Every send also writes an event with a **redacted** preview.

**Provider note:** business-initiated WhatsApp messages need either an approved template (Meta) or an open session where the recipient messaged you first (Twilio sandbox: recipients send the join code). For the demo, have every demo phone message your WhatsApp number beforehand.

### 4.1 Pre-arrival note → receiving hospital (English)
```
Haazir · Incoming referral {code}
From: {doctor_name}, {referring_facility} · {doctor_phone}
Patient: {patient_name} · {who}, {case_label}, {acuity}
Note: {note}
Needs: {needs_labels}
ETA: about {eta_minutes} min by {transport}
Confirmed by: {contact_person} at {confirmed_time}
Questions: call {doctor_phone}
```
The patient name is included **only** in this message, and only after acceptance. Omit the line if it's empty.

### 4.2 Confirmation → referring doctor
```
Haazir · {code} confirmed
{hospital_name} · about {eta_minutes} min · {bed_type_label}
Ask for: {contact_person} · Desk: {desk_number}
Conditions: {conditions}
Bed held until {hold_until_time}
```

### 4.3 Family (attendant) message, in `attendant_language`
Map link format: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`

- **en:** `Haazir referral {code}: Dr. {doctor_name} has arranged treatment for the patient at {hospital_name}. Address: {hospital_address}. Map: {map_link}. Show this message at the casualty desk and ask for {contact_person}.`
- **kn:** `ಹಾಜಿರ್ ರೆಫರಲ್ {code}: ಡಾ. {doctor_name} ಅವರು ರೋಗಿಗೆ {hospital_name} ನಲ್ಲಿ ಚಿಕಿತ್ಸೆಯ ವ್ಯವಸ್ಥೆ ಮಾಡಿದ್ದಾರೆ. ವಿಳಾಸ: {hospital_address}. ನಕ್ಷೆ: {map_link}. ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್‌ನಲ್ಲಿ ಈ ಸಂದೇಶವನ್ನು ತೋರಿಸಿ ಮತ್ತು {contact_person} ಅವರನ್ನು ಕೇಳಿ.`
- **hi:** `हाज़िर रेफ़रल {code}: डॉ. {doctor_name} ने मरीज़ के इलाज की व्यवस्था {hospital_name} में की है। पता: {hospital_address}। नक्शा: {map_link}। कैज़ुअल्टी डेस्क पर यह संदेश दिखाएँ और {contact_person} से मिलें।`

*Have a native speaker check the Kannada and Hindi lines before the demo.*

---

## 5. Events (audit log and UI timeline)

| `type` | When | `payload` (never patient identifiers) |
|---|---|---|
| `referral_created` | 2.2 | `{case_type, acuity, required_capabilities}` |
| `wave_dispatched` | Each wave | `{wave, facility_ids}` |
| `call_queued` / `call_ringing` / `call_answered` / `call_ended` | Webhook | `{facility_id, status, termination_reason}` |
| `outcome_recorded` | Function, extraction or manual | `{facility_id, outcome, bed_type, ready_in_minutes, source}` |
| `doctor_callback_requested` | 3.2 | `{facility_id, facility_name, number, reason}` |
| `inbound_callback` | 3.2 inbound | `{facility_name, number, message}` |
| `callback_scheduled` | 3.2 | `{facility_id, due_at}` |
| `needs_review` | Reconciliation conflict | `{facility_id, function_outcome, extraction_outcome}` |
| `options_ready` | First acceptance | `{facility_id, ttfa_seconds}` |
| `facility_selected` | 2.4 | `{facility_id}` |
| `transfer_consent_recorded` | 2.7a | `{consent, reason}`; not shown on the timeline |
| `ambulance_status` | 2.7d | `{status}`; not shown on the timeline |
| `attachment_added` / `attachment_removed` | 2.7e | `{kind, size_bytes}` / `{}`; not shown on the timeline |
| `treatment_started` | 2.7f | `{}`; not shown on the timeline |
| `hold_confirmed` / `hold_declined` | 3.2 | `{facility_id, contact_person}` |
| `handoff_sent` | Message sent | `{audience, to_masked, status, preview_redacted}` |
| `release_dispatched` | Release call | `{facility_id}` |
| `hold_expired` | Evaluator | `{facility_id}` |
| `arrival_check_dispatched` | Evaluator, `ETA + ARRIVAL_CHECK_AFTER_MIN` after confirmation | `{facility_id}` |
| `arrival_confirmed` / `not_arrived` | 3.2 `record-arrival` | `{facility_id}` |
| `referral_exhausted` / `referral_cancelled` / `referral_closed` | State changes | `{reason}` |
| `alert` | Guardrails reschedule, low balance, concurrency limit | `{kind, message}` |

---

## 6. Calling Bolna (outbound)

| Call | Request |
|---|---|
| Make call | `POST https://api.bolna.ai/call` · `Authorization: Bearer <BOLNA_API_KEY>` · body `{agent_id, recipient_phone_number, from_phone_number?, user_data, agent_data: {language}, bypass_call_guardrails: true}` → `{status: "queued", execution_id}` **[B1]** |
| Stop a queued call | `POST https://api.bolna.ai/call/{execution_id}/stop` (queued or scheduled only) |
| Read an execution | `GET https://api.bolna.ai/executions/{execution_id}` (fallback if a webhook is missed) **[B7]** |

`user_data` per agent type is specified in `05-voice-agents.md` §3. Handle **429** on `POST /call` (a newly bought number still activating: wait `retry_after_seconds`) and **400** (bad number or agent) by marking the attempt `failed` with an `alert` event.
