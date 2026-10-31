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
  "simulated": false,
  "wave": 1,
  "attempts": [
    { "id": "a1…", "facility_id": "…0103", "facility_name": "Tamarind District Hospital (Demo)", "rank": 1, "eta_minutes": 18, "distance_km": 6.4, "call_language": "kn", "status": "queued", "rank_reasons": ["18 min away", "has ICU bed + ventilator"] }
  ]
}
```

| Rule | Detail |
|---|---|
| Required | `referrer_id`, `case_type`, `acuity`, `required_capabilities` (can be empty only for `other`) |
| `simulate` (optional) | `true` runs this referral through the simulator (`02-architecture.md` §10) and marks it `is_simulated`, so the board shows a SIMULATED badge |
| `note` | 160 characters max. **Rejected** (422 `NOTE_CONTAINS_IDENTIFIER`) if it has 9 or more consecutive digits, an Aadhaar-like pattern, or an email. **Warned** for honorific + capitalised word |
| No eligible hospitals | 409 `NO_ELIGIBLE_FACILITIES` with `suggestions: ["widen radius to 80 km", "remove: neurosurgeon"]` |
| Partial dispatch failure | Still 201. The failed attempts have `status: "failed"`, and an event records the Bolna error |
| Side effects | Insert `referrals` and `patient_details`; atomic claim of wave 1; insert attempts; call Bolna in parallel; events `referral_created`, `wave_dispatched`, `call_queued` × N |

### 2.3 `GET /api/referrals/:id`
Returns the referral (no identifiers), attempts joined with facility name, coordinates, ETA and contact role, the latest 200 events, and message **previews** (`{audience, to_masked, status, preview_redacted}`).

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

### 2.8 `POST /api/referrals/:id/tick`
Runs `evaluateReferral`. In simulation mode it also advances the scenario. Called by the open console every 5 s (1 s in simulation).
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

### 2.12 Demo
| Route | Purpose |
|---|---|
| `POST /api/demo/reset` | Delete `is_demo` referrals (cascades), rerun the seed, reset contact stats |
| `POST /api/demo/assign-numbers` | `{ "assignments": [{ "facility_id": "…0103", "phone": "+91…", "whatsapp": "+91…" }], "referrer_phone": "+91…", "family_phone": "+91…" }` |
| `POST /api/demo/test-call` | `{ "facility_id": "…", "consented_test": false }` places one availability call with the fictional demo summary, to rehearse each phone. Set `consented_test: true` for calls to real consenting desks: it fills `call_prefix` so the call opens with "This is a test call agreed with your hospital." |

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

Sent by `WhatsAppService.send` (`lib/modules/handoff/whatsapp.service.ts`) with provider `meta`, `twilio` or `none`. With `none`, or if a send fails, the row is stored as `simulated` or `failed` and the UI shows the preview. Every send also writes an event with a **redacted** preview.

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
| `referral_created` | 2.2 | `{case_type, acuity, required_capabilities, simulated}` |
| `wave_dispatched` | Each wave | `{wave, facility_ids}` |
| `call_queued` / `call_ringing` / `call_answered` / `call_ended` | Webhook | `{facility_id, status, termination_reason}` |
| `outcome_recorded` | Function, extraction or manual | `{facility_id, outcome, bed_type, ready_in_minutes, source}` |
| `doctor_callback_requested` | 3.2 | `{facility_id, facility_name, number, reason}` |
| `inbound_callback` | 3.2 inbound | `{facility_name, number, message}` |
| `callback_scheduled` | 3.2 | `{facility_id, due_at}` |
| `needs_review` | Reconciliation conflict | `{facility_id, function_outcome, extraction_outcome}` |
| `options_ready` | First acceptance | `{facility_id, ttfa_seconds}` |
| `facility_selected` | 2.4 | `{facility_id}` |
| `hold_confirmed` / `hold_declined` | 3.2 | `{facility_id, contact_person}` |
| `handoff_sent` | Message sent | `{audience, to_masked, status, preview_redacted}` |
| `release_dispatched` | Release call | `{facility_id}` |
| `hold_expired` | Evaluator | `{facility_id}` |
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
