# 10 · Research and Sources

Everything the blueprint and pitch rely on, with links. Paraphrased; check the original before quoting it on a slide.
Compiled 25–28 Oct 2026.

---

## 1. Evidence for the problem

| ID | Finding | Why it matters for Haazir |
|---|---|---|
| S1 | **Delhi High Court, July 2026**: surprise audit of 38 Delhi government hospitals after a patient was allegedly refused an ICU bed while the portal showed availability. The audit checks bed-data accuracy and whether emergency ICU calls are being answered. | Portals go stale; the court is asking for exactly the record Haazir creates |
| S31 | Delhi HC asked for a live demo of the "Delhi ICU Beds Saarthi" app and the hospital information system (July 2026). | Government is actively looking for bed-visibility fixes |
| S2 | **Delhi HC order, 18 Sep 2026**: 102 made the dedicated ICU-bed number for 38 government hospitals; operators read an ICU dashboard; the court's test call got through only after several attempts; referral coordinators to be listed per hospital. | A human helpline is only as current as the dashboard behind it |
| S3 | Delhi HC directed real-time information on ICU beds and specialists, and asked whether helpline callers could be routed to hospitals with beds and staff. | Policy demand for live routing |
| S4 | **Bengaluru, April 2021**: complaints that BBMP's bed data wasn't updated in real time; patients rushed between hospitals. | Same failure, five years earlier |
| S5, S6 | Alleged bed-blocking racket in BBMP war rooms (beds blocked in the names of patients who never came, then resold); police searches; seven arrests reported. | Our "hold" design must be abuse-proof |
| S29, S30 | BBMP built a bed allocation system and a public dashboard (2021) with volunteer engineers. | Dashboards are the default fix and keep repeating |
| S7 | **ORF**: referral breakdowns leave ambulances shuttling patients in search of ICU beds; emergency beds are 3–5% of beds although 18–40% of admissions come through emergency. | Referral is the bottleneck |
| S8 | India had about 2.3 ICU beds per 100,000 people (2017 survey cited by Think Global Health). | Scarce capacity makes "who has one *now*" valuable |
| S11 | AIIMS New Delhi casualty dashboard (2022); its director called for a "human network to communicate between hospitals before referrals". | Even top institutions see the need for hospital-to-hospital communication |
| S28 | Million Death Study (eLife, 2020): about 1.2 million snakebite deaths in India between 2000 and 2019, roughly 58,000 a year. *Cited from prior knowledge; not re-checked this session.* | Context only. **Do not claim Haazir prevents these deaths**; use it to explain why snakebite needs specific hospitals |

## 2. Competitive landscape

### 2.1 India: referral, bed and emergency platforms

| ID | Product | What it does | Dependency or gap |
|---|---|---|---|
| S9, S10 | **Aapat Setu** (AIIMS Bilaspur, launched end of June 2026; built by a 14-year-old student) | Referring hospitals upload history, reports and status before the patient arrives; specialists get SMS alerts; a bed and specialist dashboard is planned once Himachal's hospitals are connected | Hospitals register with institutional credentials. It sends the file to a chosen hospital but doesn't find one. **Complementary** |
| S1, S31 | **Delhi ICU Beds Saarthi + HMIS** | Real-time ICU bed data across 38 hospitals | Accuracy is now under court audit |
| S30 | **BBMP CHBMS** (Bengaluru, 2021) | Central bed allocation and dashboard | Data lag; bed-blocking abuse |
| S22 | **Beacon Aid** (MIT Solve) | Sends an emergency request to several partner hospitals at once | Requires partner hospitals |
| S23 | **Lyf Wins** | Lists vacant ICU/NICU/ventilator beds at nearby hospitals | Requires hospital reporting |
| S20, S21 | **Red Health** | Ambulance network; relationship managers stationed in partner hospitals; raised $20M (2024) and said it was building AI tools | Most likely incumbent to build something similar. Also a potential **buyer or partner** |

### 2.2 Global analogues: AI that phones around

| ID | Product | What it does | Gap |
|---|---|---|---|
| S12, S13 | **Google "Ask for Me"** (US, 2025) | AI calls local businesses (nail salons, auto shops) for prices and availability; discloses it's AI; businesses can opt out; summary arrives in about 30 minutes | Not emergencies; slow; English, US only |
| S14 | **Needle** | Calls pharmacies to find drugs in short supply; 20,000+ calls a month; some reviews say pharmacists refuse to give stock to bots | Proves the pattern works, and shows the trust problem |
| S15 | **FindUrMeds** | 20–30 concurrent pharmacy calls per search; names MedFinder as a direct competitor | Consumer pharmacy use case |
| S16 | Pharmacist discussion (May 2026) | Pharmacists hang up on AI calls asking about controlled-drug stock | Design for trust: name the doctor, share minimal data |
| S17 | **WWT discharge placement agent** (Aug 2026, lab build) | Calls nursing homes to confirm beds and capabilities before discharge; case manager makes the final call | Same mechanic in a non-emergency US setting. A good "this works" reference |
| S18 | **Pulsara** (US) | Ambulance-to-hospital pre-arrival channel; free prehospital tier | Both sides must use the platform |
| S19 | **UTSW TransferAgent** (US, academic) | Epic-integrated triage for inter-hospital transfers | Inside one health system's EHR |

### 2.3 Indian healthcare voice AI: all inbound

| ID | Product | What it does |
|---|---|---|
| S24 | Bolcho | Answers hospital calls 24×7, books across departments, routes emergencies |
| S25 | HuskyVoice | AI receptionist for hospitals and clinics |
| S26 | Aarogya Mitra (hackathon project) | Voice health assistant for public healthcare navigation, including bed information |

**Takeaway:** nobody found combines **outbound parallel calls + live acceptance + Indian languages + emergency referral**. Unannounced startups and other buildathon teams can't be seen, so assume someone may build something similar.

## 3. How Haazir answers each gap

| Gap in the market | Haazir's answer |
|---|---|
| Data freshness depends on hospitals updating screens | Ask live by phone (pull) |
| Platforms need both sides onboarded | Only a phone number needed |
| AI calling tools are slow and not built for emergencies | Parallel waves; TTFA measured |
| AI calls get hung up on | Named doctor, minimal data, short script, doctor callback |
| Tools stop at "find" or "send file" | Hold, hand off, release, family |
| No accountability | Read-back, recording, timestamped audit |

## 4. Field scan: other Symphony Buildathon entrants (28 Oct 2026)

Scored from one-line Slack intros, so treat as **low confidence**. Several may be teams' startups rather than their entries. Criteria are each out of 10: impact, Bolna fit, originality, proof, who pays, demo, buildable.

| Project | Impact | Bolna fit | Orig. | Proof | Pays | Demo | Build | Total /70 |
|---|---|---|---|---|---|---|---|---|
| voice-doctor | 5 | 9 | 7 | 8 | 3 | 6 | 10 | **48** |
| **Haazir (as pitched)** | 9 | 8 | 7 | 1 | 4 | 9 | 5 | **43** |
| Swarelic | 6 | 5 | 5 | 5 | 6 | 7 | 8 | 42 |
| Dael.ai | 5 | 7 | 3 | 5 | 7 | 6 | 8 | 41 |
| Revyn | 4 | 6 | 3 | 6 | 7 | 5 | 9 | 40 |
| Healthcare-distribution entry | 6 | 7 | 5 | 2 | 8 | 5 | 7 | 40 |
| vaakyo | 6 | 5 | 3 | 6 | 6 | 5 | 9 | 40 |
| Voxie | 5 | 3 | 4 | 6 | 3 | 6 | 9 | 36 |
| Nyx | 6 | 6 | 5 | 1 | 5 | 5 | 6 | 34 |
| **Haazir after fixes** | 9 | 8 | 7 | 5 | 6 | 9 | 8 | **52** |

| Judging lens | Haazir as pitched | Haazir after fixes |
|---|---|---|
| Equal weights (/70) | 43, 2nd | 52, 1st |
| Investor-style: proof and who pays count double (/90) | 48, 7th | 63, 1st |
| Showcase-style: impact and demo count double (/90) | 61, 1st | 70, 1st |

**The three fixes:** proof 1→5 (consented test calls plus doctor interviews), who pays 4→6 (name one buyer), buildable 5→8 (cut scope to the core loop).

## 5. Bolna facts used in the design

| ID | Fact | Design consequence |
|---|---|---|
| B1 | `POST https://api.bolna.ai/call` with `agent_id`, `recipient_phone_number`, optional `from_phone_number`, `user_data`, `agent_data.language`, `retry_config`, `bypass_call_guardrails`; returns `execution_id` | One call per hospital; per-call context in `user_data`; start language per hospital |
| B1 | `retry_config` intervals are in minutes (defaults 30/60/120) | Too slow for emergencies, so we redial ourselves |
| B19 | `scheduled_at` must be at least 2 minutes ahead, is rounded up to the next 10-minute mark, and needs a numeric offset (`Z` returns 500) | Don't use for callbacks; use our own scheduler |
| B2, B3 | Custom functions: `key: "custom_task"`, `value.method/url/param/api_token/headers`; `param` uses `%(name)s`; POST sends `param` as JSON, GET as a query string; `pre_call_message` is spoken while it runs | Mid-call `record_hospital_response` POST to our API |
| B4 | Context variables defined in the prompt and passed at call time are auto-substituted into `param`; system variables include `to_number`, `from_number`, `agent_id` | Pass `attempt_id` in `user_data`; fall back to `to_number` |
| B12 | `{var}` or `{{var}}` in prompts from `user_data`; nested paths supported; system variables include `execution_id`, `call_sid`, `current_time`; pass `timezone` | Prompt templates use variables |
| B5, B6 | Webhook on every status change (configured per agent in the Extractions tab); statuses are `queued, initiated, ringing, in-progress, call-disconnected, completed, no-answer, busy, failed, canceled, stopped, error, balance-low` (plus `scheduled`, `rescheduled`) | Drives the live board |
| B6, B19 | Wait for `completed` before reading transcript, recording, cost or extractions | Reconcile on `completed` only |
| B5, B19 | Webhooks and function calls come from 13.203.39.153, 13.126.9.249 and 13.202.133.53 | Optional IP allowlist |
| B7 | Execution includes `termination_reason`, `transcript`, `extracted_data`, `context_details`, `telephony_data.recording_url`, `answered_by_voice_mail` | Stored per attempt |
| B8 | Termination reasons include `user_hung_up`, `agent_ended_call`, `call_transferred`, `inactivity_timeout`, `voicemail_reached`, `no_answer`, `busy`, `number_blocked`, `concurrency_limit_reached`, … | Mapped to outcomes |
| B9 | **Trial: 2 concurrent calls, verified numbers only. Paid: starts at 10.** Over the limit, calls queue rather than fail | Check tier before demo |
| B10 | Calling guardrails (off by default) reschedule out-of-window calls; per call `bypass_call_guardrails: true` | Emergencies are 24×7, so keep guardrails off and bypass anyway |
| B11 | Transfer destination is set on the tool (phone or SIP); per-call dynamic destination isn't documented | Doctor-callback pattern by default |
| B13 | Extractions: categories hold extraction templates; results are nested `extracted_data → category → name → {subjective, objective, confidence, confidence_label, …}` | Fallback outcome plus conflict check |
| B14 | Kannada `kn`, Hindi `hi` and other Indian languages with mid-call auto-switching; Sarvam `saaras:v4` recommended for STT; start language via `agent_data.language` | Hospital-level call language |
| B15 | Keypad (DTMF) is documented for capturing the caller's key presses only; nothing documents the agent sending them | Don't count on navigating IVRs, so we need direct numbers |
| B16, B17 | Voicemail detection, noise cancellation, user-online detection, hangup on silence, total call timeout | Agent settings in `05-voice-agents.md` |
| B20 | Bolna Skills for coding assistants: `npx skills add bolna-ai/skills -a claude-code` | In `CLAUDE.md` |

## 6. Sources

**Problem and policy**
- [S1] [LiveLaw: Delhi HC orders surprise audit of 38 hospitals](https://www.livelaw.in/amp/high-court/delhi-high-court/delhi-high-court-orders-surprise-audit-of-38-govt-hospitals-after-patient-denied-icu-bed-despite-portal-showing-availability-540251)
- [S2] [Delhi High Court order, 18 Sep 2026](https://delhihighcourt.nic.in/app/showFileJudgment/PMS18092026CW39032017_180908.txt)
- [S3] [Tribune: Delhi HC directs real-time info on beds and doctors](https://www.tribuneindia.com/news/delhi/give-patients-real-time-info-on-availability-of-hospital-beds-doctors-delhi-hc-directs-govt)
- [S4] [SabrangIndia: BBMP struggles to maintain bed data (2021)](https://sabrangindia.in/bengaluru-braces-lockdown-bbmp-struggles-maintain-covid-data/)
- [S5] [The Week: bed allocation scam allegation (2021)](https://www.theweek.in/news/india/2021/05/04/tejasvi-surya-alleges-bed-allocation-scam-in-bbmp-war-room.amp.html)
- [S6] [Deccan Herald: searches at BBMP war rooms (2021)](https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Fbengaluru%2Fhospital-bed-scam-searches-conducted-at-bbmp-covid-war-rooms-983124.html)
- [S7] [ORF: Integrating India's emergency response](https://www.orfonline.org/index.php/expert-speak/integrating-india-s-emergency-response-a-health-system-priority)
- [S8] [Think Global Health: 10 Bed ICU](https://thinkglobalhealth.org/article/10-bed-icu-brings-intensive-care-units-indias-rural-towns-and-villages)
- [S11] [Tribune: AIIMS real-time emergency bed dashboard (2022)](https://www.tribuneindia.com/news/nation/now-know-emergency%c2%a0bed-status%c2%a0at-aiims-real-time-dashboard-launched-445647)
- [S27] [The Week: DPDP Rules notified, phased over 12–18 months (Nov 2025)](https://www.theweek.in/wire-updates/business/2025/11/14/del148-biz-dpdp-rules-ld-govt.html)
- [S28] [eLife: snakebite deaths in India 2000–2019](https://elifesciences.org/articles/54076)
- [S29] [PayPal: engineers built BBMP bed tracker (2021)](https://newsroom.paypal-corp.com/2021-08-17-How-Three-PayPal-Engineers-Developed-A-Hospital-Bed-Tracker-To-Support-COVID-Relief-Efforts-In-India)
- [S30] [Deccan Herald: BBMP public bed dashboard (2021)](https://www.deccanherald.com/city/bengaluru-infrastructure/new-dashboard-lets-people-check-bed-status-in-real-time-988196.html)
- [S31] [LiveLaw: Delhi HC seeks live demo of ICU Beds app](https://www.livelaw.in/amp/high-court/delhi-high-court/delhi-high-court-seeks-live-demo-of-delhi-govts-icu-beds-app-hospital-management-platform-539653)

**Competitors and analogues**
- [S9] [Medical Dialogues: Aapat Setu](https://medicaldialogues.in/news/health/hospital-diagnostics/aiims-bilaspur-launches-aapat-setu-to-streamline-emergency-patient-referrals-174137)
- [S10] [Digital Health News: Aapat Setu registration](https://www.digitalhealthnews.com/aiims-bilaspur-launches-aapat-setu-digital-platform-to-streamline-emergency-referrals-)
- [S12] [9to5Google: Ask for Me](https://9to5google.com/2025/01/30/google-ask-for-me-lab/)
- [S13] [Android Authority: Ask for Me](https://androidauthority.com/google-search-ask-for-me-3521795)
- [S14] [Needle reviews (Trustpilot)](https://ca.trustpilot.com/review/findneedle.co)
- [S15] [FindUrMeds founder write-up](https://thingsibuild.substack.com/p/my-betaworks-application-building)
- [S16] [Pharmacists on AI stock calls (May 2026 snapshot)](https://reddit.sentinel-team.org/posts/1thuyh6/snapshots/2026-05-20T06%3A17%3A29.34775Z)
- [S17] [WWT: The phone call nobody should be making](https://www.wwt.com/blog/the-phone-call-nobody-should-be-making)
- [S18] [Pulsara packages](https://www.pulsara.com/packages)
- [S19] [UTSW TransferAgent](https://www.utsouthwestern.edu/innovation-hub/assets/blocks/modal-s6-rubio.html)
- [S20] [Red Health hospital relationship manager role](https://arkajainuniversity.ac.in/wp-content/uploads/2025/07/14-RED.HEALTH-Stanplus-Technologies-Hospital-Relationship-Manager-Hospital-Sales.pdf)
- [S21] [Red Health funding (2024)](https://finder.techleap.nl/news/feed/red-health-raises-20m-for-expansion)
- [S22] [Beacon Aid (MIT Solve)](https://solve.mit.edu/solutions/67080)
- [S23] [Lyf Wins](https://sc-in.globallinker.com/network/healthcare-medical-supplies-pharmaceuticals/dlyfwins-infotech-pvt-ltd-201834)
- [S24] [Bolcho: voice AI for hospitals](https://bolchoai.in/resources/voice-ai-for-hospitals)
- [S25] [HuskyVoice healthcare voice AI](https://www.huskyvoice.ai/healthcare-voice-ai)
- [S26] [Aarogya Mitra (DEV Community)](https://dev.to/subhranshu/i-built-a-voice-health-agent-for-bharat-in-10-days-1oaa)

**Bolna documentation**
- [B1] [Make call API](https://www.bolna.ai/docs/api-reference/calls/make.md)
- [B2] [Custom function schema](https://www.bolna.ai/docs/tool-calling/custom-function-schema.md)
- [B3] [Custom function examples](https://www.bolna.ai/docs/tool-calling/custom-function-examples.md)
- [B4] [Variables in custom functions](https://www.bolna.ai/docs/tool-calling/custom-function-variables.md)
- [B5] [Call status webhooks](https://www.bolna.ai/docs/post-call/polling-call-status-webhooks.md)
- [B6] [Call flow and statuses](https://www.bolna.ai/docs/concepts/call-flow.md)
- [B7] [Get execution](https://www.bolna.ai/docs/api-reference/executions/get_execution.md)
- [B8] [Termination reasons](https://www.bolna.ai/docs/post-call/termination-reasons.md)
- [B9] [Outbound concurrency tiers](https://www.bolna.ai/docs/pricing/outbound-calling-concurrency.md)
- [B10] [Calling guardrails](https://www.bolna.ai/docs/outbound/calling-guardrails.md)
- [B11] [Transfer calls](https://www.bolna.ai/docs/tool-calling/transfer-calls.md)
- [B12] [Dynamic variables](https://www.bolna.ai/docs/prompting/using-context.md)
- [B13] [Extractions](https://www.bolna.ai/docs/prompting/using-extractions.md) · [Extraction output format](https://www.bolna.ai/docs/prompting/extraction-output.md)
- [B14] [Supported languages](https://www.bolna.ai/docs/customizations/supported-languages.md) · [Kannada agents](https://www.bolna.ai/docs/customizations/languages/kannada.md)
- [B15] [DTMF (inbound keypad input)](https://www.bolna.ai/docs/inbound/dtmf.md)
- [B16] [Call tab settings](https://www.bolna.ai/docs/agent-setup/call-tab.md)
- [B17] [Engine tab settings](https://www.bolna.ai/docs/agent-setup/engine-tab.md)
- [B18] [Hanging up calls](https://www.bolna.ai/docs/outbound/hangup-calls.md)
- [B19] [AGENTS.md for coding assistants](https://www.bolna.ai/docs/AGENTS.md)
- [B20] [Bolna Skills installation](https://www.bolna.ai/docs/build-with-ai/installation.md)
- [B21] [Docs index (llms.txt)](https://www.bolna.ai/docs/llms.txt)
