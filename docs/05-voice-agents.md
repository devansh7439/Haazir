# 05 · Voice Agents (Bolna)

What each agent says, how it's configured, and how to test it. The exact text to paste lives in `bolna/prompts/*.md`, the tool JSON in `bolna/tools/*.json`, and extraction setup in `bolna/extractions.md`.

---

## 1. Agents at a glance

| Agent | Env var | When it calls | Tools | Extraction | Max length |
|---|---|---|---|---|---|
| **Availability** | `BOLNA_AGENT_ID_AVAILABILITY` | Each hospital in a wave; redials and callbacks | `record_hospital_response`, `request_doctor_callback`, `request_callback` | `Referral outcome` | 180 s |
| **Hold confirmation** | `BOLNA_AGENT_ID_HOLD_CONFIRM` | The chosen hospital, right after the doctor selects | `record_hold_confirmation` | `Hold` | 120 s |
| **Release** | `BOLNA_AGENT_ID_RELEASE` | Hospitals that accepted but weren't chosen | — | — | 60 s |
| **Family update** (stretch) | `BOLNA_AGENT_ID_FAMILY` | Attendant, after the hold is confirmed | — | — | 120 s |
| **Inbound callback** (should-have) | attach to the caller-ID number | When a hospital calls back | `report_inbound_callback` | — | 90 s |

Keep **separate dev and demo copies** of each agent. Webhook and tool URLs live inside the agent, so the dev copies point at your tunnel and the demo copies point at production.

---

## 2. Shared settings

| Setting (dashboard tab) | Value | Why |
|---|---|---|
| LLM (Agent) | A fast model available in your account; compare latency on 3 test calls | Turns are short; speed matters more than eloquence |
| Languages (Agent) | `multilingual_config` with **en, kn, hi**; auto-detect and switch **on** | Desks switch languages mid-sentence **[B14]** |
| Transcriber | **Sarvam `saaras:v4`** for `kn` and `hi` (Bolna's Kannada guide calls Sarvam usually the strongest for Indian callers); keep the same for `en` unless English accuracy is worse | Indian accents and code-mixing |
| Transcriber keywords | Your demo hospital names, "ICU", "ventilator", "anti-snake venom", "casualty", "NICU", "referral" | Better recognition of key terms (`keywords` needs `saaras:v4`) |
| Voice | Sarvam `bulbul:v4-flash` (Kannada voices) or `bulbul:v3`; ElevenLabs as an alternative. Match the Hindi verb gender in the welcome text to the voice | Natural Indian voices |
| Noise cancellation (Call) | **On** (85% default) | Casualty desks are noisy |
| Voicemail detection (Call) | **Off** | Hospital emergency desks are unlikely to use voicemail (check in testing), and Bolna notes that false positives hang up on real people **[B16]** |
| Keypad input / DTMF (Call) | Off | Documented only for capturing the caller's key presses, not for navigating menus **[B15]** |
| Outbound calling hours (Call) | **Off**, and send `bypass_call_guardrails: true` on every call | Emergencies are 24×7 **[B10]** |
| Auto reschedule (Call) | Off | We schedule callbacks ourselves |
| Interruptions (Engine) | Wait about 2 words before stopping; stopwords: "wait", "ruko", "ಒಂದು ನಿಮಿಷ" | Desks interrupt constantly |
| User-online detection (Engine) | On; after about 15 s say "I'm still here, please take your time." (per language) | Keeps the line open while they check the ward |
| Hangup on user silence (Engine) | **30–45 s** (find the largest value the dashboard allows) | "Hold on, let me check" often means 20+ seconds of silence |
| Total call timeout (Engine) | As in §1 | Bounds cost and runaway calls |
| Hangup using a prompt (Agent) | On; text is in each prompt file | Ends cleanly after the tool returns **[B18]** |
| Final call message (Engine) | Per language, in each prompt file | |
| Webhook URL (Extractions) | `https://<app>/api/bolna/webhook?token=<BOLNA_WEBHOOK_SECRET>`, all statuses | Drives the live board **[B5]** |
| Caller ID | An **Indian** number, the same for all agents | Unknown international numbers don't get answered |

---

## 3. What we send per call (`user_data`)

Availability example (the hospital hears no identifiers):

```json
{
  "attempt_id": "5b1f0c7e-1f7a-4c3e-9a51-0c9d1e2f3a4b",
  "doctor_name": "Dr. Meera Rao",
  "referring_facility": "Hoskote PHC",
  "facility_name": "Tamarind District Hospital",
  "referral_code_spoken": "R 4 8 2 1",
  "case_summary": "Man aged 34, suspected snakebite with neurotoxic signs, critical. Drooping eyelids and trouble swallowing 2 hours after bite. Given 10 vials of anti-snake venom. Needs an ICU bed and a ventilator.",
  "needs_spoken": "an ICU bed and a ventilator",
  "eta_minutes": "18",
  "timezone": "Asia/Kolkata",
  "call_prefix": ""
}
```

Also send `agent_data: { "language": "<facilities.call_language>" }` and `bypass_call_guardrails: true`.
`call_prefix` is empty for real referrals and holds the test sentence for consented test calls (`09-validation-safety-compliance.md` §1.3).

**Rules enforced in code**
- Availability `user_data` must never contain `patient_name`, `attendant_*` or any phone number except Bolna's own `to_number`. Add a unit test that fails if it does.
- Strip "(Demo)" from facility names before sending.
- `accepted_by` (hold-confirm) falls back per language: en `your desk` · hi `आपकी डेस्क` · kn `ನಿಮ್ಮ ಡೆಸ್ಕ್`.
- `attempt_id` must appear in each prompt (it does), because only prompt variables are auto-filled into tool params **[B4]**. **Day-1 check:** make one test call and confirm the function route receives a real UUID, not an empty value or `%(attempt_id)s`. If it doesn't, the route falls back to matching on `to_number`.

---

## 4. Languages

- Start each call in the hospital's `call_language` with `agent_data.language`. It must match a language key configured on the agent, or Bolna returns 400 **[B1]**.
- Bolna's Kannada guide: use code `kn` for both transcriber and synthesizer (not `kn-IN`), write Kannada prompts in **Kannada script**, and ask for the **polite plural** **[B14]**. Start with the shared English prompt plus the line "Speak in Kannada, using polite plural forms." If quality is poor, translate the prompt into Kannada script.
- Numbers: ask the agent to confirm numbers back, and to read phone numbers digit by digit. Code-mixed speech ("ICU bed ಇದೆ") is normal, and Sarvam handles English words inside Kannada sentences.
- **Native-speaker check:** every Hindi and Kannada line in this pack was drafted for you. Have a native speaker read them aloud with the chosen voice before the demo.

---

## 5. Conversation rules (apply to every agent)

1. Say who's calling (an automated assistant for a named doctor) in the first sentence. Never pretend to be human.
2. Disclose recording in the welcome message.
3. One question at a time; short sentences.
4. **Read back before recording.** No `accepted` without a clear "yes" to the read-back.
5. A "no" is a valid answer. Never argue, persuade or repeat the ask more than once.
6. Never share identifiers on availability calls. Identifying details go on WhatsApp after acceptance.
7. No medical advice, no promises about money.
8. Follow the desk's language.
9. Leave silence alone while they check; offer a callback if it's long.
10. End cleanly: thank them, final message, hang up.

---

## 6. Edge-case playbook

| Situation | Agent behaviour | Recorded as |
|---|---|---|
| Clear yes | Asks ready-time and contact, reads back, records | `accepted` |
| Yes, with a condition ("only if…") | Captures the condition in their words | `conditional` |
| No | Reads the "no" back, then records it. Records a reason only if they gave one; never asks for one | `declined` (+ `decline_reason` if given) |
| "Hold on, let me check" | "Sure, I'll wait." User-online message at about 15 s | Final answer |
| "Call back in 5 minutes" | Calls `request_callback`; our scheduler redials (capped at 10 min) | `callback_later` → new attempt |
| "Talk to the doctor" / clinical questions | Calls `request_doctor_callback`; promises a callback in about 2 min | `needs_doctor` + banner |
| Wrong department, "call this number" | Records the alternate number | `redirected` → new attempt |
| Asks for patient name or ID | Explains it comes on WhatsApp after acceptance | Continues |
| "Are you a robot?" | "I'm an automated assistant working for Dr. Rao." | Continues |
| Changes answer during read-back | Uses the final answer | Final answer |
| Garbled or ambiguous after 2 tries | Thanks them and ends | `unclear` |
| IVR menu, recording or voicemail | Ends without speaking further | `ivr_blocked` (extraction or termination reason) |
| No answer / busy | — (status from Bolna) | `no_answer` / `busy` → one redial on busy |
| Desk hangs up mid-call | — | Extraction decides, else `unclear` |
| Function route fails | Tool returns a safe instruction; agent ends politely | Extraction fallback |

---

## 7. Optional: live transfer to the doctor for the stage demo

Bolna's Transfer Call tool forwards to a destination **configured on the tool** (phone or SIP). A per-call destination isn't documented **[B11]**, so in production we use the callback pattern above. For the demo only, you can add a Transfer Call tool to the **demo** availability agent:

- Destination: the demo doctor's phone (the presenter's phone on stage).
- Description: "Use only if the hospital insists on speaking to the doctor right now and will not wait for a callback."
- Pre-tool message: "Connecting you to Dr. Rao now."
- **Test it on your telephony provider first.** If it fails, stay with the callback flow; it demos well too, because the presenter taps the banner and the judge's phone rings again.

---

## 8. Setting up the agents

**Dashboard (fastest for a hackathon)**
1. Create the Availability agent: paste the welcome messages and system prompt from `bolna/prompts/availability.md`; set languages en, kn, hi; apply §2 settings.
2. Tools tab: add the three custom functions by pasting the JSON from `bolna/tools/`. Replace `YOUR_APP_URL` and `YOUR_BOLNA_FUNCTION_SECRET`.
3. Extractions tab: create category `Referral outcome` (see `bolna/extractions.md`), and set the webhook URL.
4. Copy the agent ID into `BOLNA_AGENT_ID_AVAILABILITY`.
5. Repeat for Hold confirmation and Release. Then duplicate all of them as dev copies pointing at your tunnel.
6. Test each agent with the dashboard's test call, then with `POST /api/demo/test-call`.

**With an AI coding assistant:** Bolna publishes Skills (`npx skills add bolna-ai/skills -a claude-code`) and an `AGENTS.md` with API gotchas **[B19][B20]**. Useful for scripting agent creation through `POST /v2/agent`. Note `toolchain.pipelines` is an array of arrays.

**Before demo day:** check the account's concurrency under Settings → Organisation → Account Info. **Trial = 2 concurrent calls to verified numbers only; paid starts at 10** **[B9]**. A 6-call wave on a trial account will dial 2 at a time and ruin the demo.

---

## 9. Test matrix

Run every scenario with a teammate playing the desk. Record the result in a sheet. **Gate: all pass twice in a row before the demo. Rows 1, 15 and 16 are zero-tolerance**: a false `accepted` is the worst possible bug.

| # | Scenario (tester says / does) | Expected outcome in DB |
|---|---|---|
| 1 | Clear yes in English, gives time and name | `accepted`, `ready_in_minutes`, `contact_person` filled |
| 2 | Clear yes in Kannada | `accepted`; transcript in Kannada |
| 3 | Starts in English, switches to Hindi | Agent switches; outcome correct |
| 4 | No, "ICU full" | `declined`, reason `full` or `no_bed`. Agent doesn't ask a follow-up question |
| 5 | Yes "only if you send the case sheet" | `conditional` with the condition |
| 6 | "Hold on" and 25 s of silence, then yes | Agent waits; `accepted` |
| 7 | "Call back in 3 minutes" | `callback_later`; a new attempt dials after about 3 min |
| 8 | "Let me talk to the doctor" | `needs_doctor`; banner appears in under 2 s |
| 9 | "Wrong desk, call 98xxxxxxxx" | `redirected`; new attempt to the normalised number |
| 10 | "What's the patient's name?" | Agent declines politely; call continues |
| 11 | "Are you a robot?" | Agent says it's an automated assistant |
| 12 | Play a recorded IVR message | `ivr_blocked` |
| 13 | Don't answer | `no_answer` |
| 14 | Reject the call (busy) | `busy`; one redial after 45 s |
| 15 | Ward noise playing loudly, mumbled "haan… dekhte hain" | `unclear` or a correct answer. **Never** `accepted` |
| 16 | Says yes, then "actually no ventilator" at read-back | `declined` |
| 17 | Hold confirm: yes (contact name known from the first call, WhatsApp on file) | `hold_confirmed`; referral `confirmed`; WhatsApp sent. Agent asks no name or number |
| 18 | Hold confirm: "sorry, bed just went" | `hold_declined` at once (no "why?"); referral back to `options_ready` |
| 19 | Release call | Completes; `release_ack` |
| 20 | Function route returns 500 (stop the server) | Agent still ends politely; extraction fills the outcome |

**Measure while testing:** first-audio latency (should feel under about 1 s), total call length (availability calls should be under 60 s for a straightforward yes or no), and TTFA for a full 6-phone wave.
