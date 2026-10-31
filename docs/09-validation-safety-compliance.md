# 09 · Validation, Safety and Compliance

How to get real proof without putting anyone at risk, and the rules the product never breaks.
*This is engineering guidance, not legal advice. Before any real pilot, get advice on the DPDP Act and telecom rules.*

---

## 1. Validation (your weakest score is proof, so start on day 0)

### 1.1 What you need to learn

| # | Hypothesis | How to test | Pass signal |
|---|---|---|---|
| V1 | Emergency desks answer direct-number calls quickly | Consented test calls (§1.3) | Most answered within about 20 s of ringing |
| V2 | Desks stay on the line with an automated caller that names a doctor | Consented test calls | They engage with the question instead of hanging up |
| V3 | A desk can give a yes or no in under a minute | Test calls plus interviews | Median call under 60 s |
| V4 | Referring doctors would use it at 2 a.m. | 3 interviews | "I'd use it" plus a concrete example of a past referral |
| V5 | Someone would pay | Talk to 1 ambulance or emergency-response operator | A named interest or a follow-up meeting |

### 1.2 Interview script (15 minutes)

**Referring doctor (PHC/CHC MO, small-hospital casualty MO)**
1. Tell me about the last time you had to refer a critical patient. What happened, step by step?
2. How many places did you call? How long did it take? Who answered?
3. What information did the receiving hospital ask for before saying yes?
4. When was the last time a hospital said yes on the phone and the patient was turned away at the door?
5. If an automated assistant called six hospitals for you and showed who said yes, what would worry you?
6. Would you let it share age, sex and condition, but no name, on the first call?

**Receiving desk (casualty MO, nurse in charge)**
1. Who answers the casualty phone at night? Is it a direct line or through reception?
2. What makes you say no to a referral on the phone?
3. If an automated assistant called on behalf of a named doctor and asked three questions, would you answer? What would make you hang up?
4. Would a WhatsApp pre-arrival note help? What should it contain?
5. Would you rather reply on WhatsApp than talk?

**Ambulance or emergency-response operator**
1. How do your coordinators find a hospital that will accept a critical patient?
2. How often are patients turned away after arrival? What does that cost you?
3. Would you pay per placement for this? Who decides?

Take notes; ask permission before quoting anyone by name on a slide.

### 1.3 Consented test-call protocol

**Never place unannounced or fake emergency calls to real hospitals.** A fake case ties up a line that a real patient may need, and it destroys the trust the product depends on.

1. **Get permission** from someone who can give it (medical superintendent, casualty in-charge, or the doctor who owns the line). A doctor you know personally is the easiest start.
2. **Agree a window** (e.g. 30 minutes on a quiet afternoon) and the number of calls (5–10).
3. **Label every test call.** Send `call_prefix` (see `bolna/prompts/availability.md`) so the welcome begins "This is a test call agreed with your hospital." Use the fictional demo patient.
4. **Record only with consent**, and tell them how long you keep recordings (e.g. deleted after the buildathon).
5. **Measure:** time to answer, call length, whether the agent captured the answer correctly (compare with the recording), and TTFA for a full wave if several desks take part.
6. **Thank them**, and ask for one sentence of feedback you may quote.

**Message to send when asking**
> We're engineering students building a tool that phones hospital emergency desks to ask whether they can accept a referred critical patient, so doctors don't spend the golden hour dialling. With your permission, we'd like to place 5–10 clearly labelled **test** calls to your desk on {date} between {time} and {time}. Each call starts by saying it's a test, takes under a minute, uses a fictional patient, and is recorded only for our evaluation. You can stop at any time.

### 1.4 What to show judges
- Number of consented test calls, median time to answer, median call length, **median TTFA**, and outcome accuracy (captured vs recording).
- One 10-second clip (with permission).
- Two or three interview takeaways, with names only if permitted.

---

## 2. Hard rules (the product never breaks these)

1. **Disclose:** every call says in its first sentence that it's an automated assistant calling for a named doctor, and that the call is recorded.
2. **No identifiers before acceptance:** availability calls carry age, sex, condition and needs only. A code-level test enforces this.
3. **Read back before recording:** never record `accepted` without a clear confirmation. A false accept is the worst bug.
4. **The doctor decides:** the system never selects a hospital or dispatches a patient on its own.
5. **No medical advice** from any agent.
6. **No money:** agents never promise payment, deposits or fees, and ranking is never for sale.
7. **No fake emergencies:** test only with consent and labelled calls.
8. **Holds expire:** one active hold per referral, tied to a real referral and doctor, auto-expiring, fully logged.
9. **Respect the desk:** bounded waves, one redial at most on busy, prompt release calls, honour opt-outs.
10. **Be honest on stage:** label simulations; quote only measured numbers.

---

## 3. Privacy and the DPDP Act

The DPDP Rules were notified in November 2025, with obligations phasing in over 12–18 months **[S27]**. Design for them now.

| Data | Whose | Purpose | Where | Retention (proposal) |
|---|---|---|---|---|
| Age, sex, condition, needs, short note | Patient (de-identified) | Find a hospital | `referrals`, spoken on calls | Keep de-identified for analytics |
| Patient name; attendant name, phone, language | Patient and family | Handoff to the accepting hospital; family message | `patient_details` (server-only) | Delete 30 days after closing |
| Message bodies | Patient and family | Handoff | `messages` (server-only) | Delete 30 days after closing |
| Doctor name and phone | Referrer | Calls and handoff | `referrers` | While the account is active |
| Staff names given on calls; voices in recordings | Hospital staff | Accountability | `call_attempts` | Per the agreement with the hospital |

**Practices**
- **Notice and consent:** the referring doctor tells the attendant that their details will be shared with the receiving hospital and used for a WhatsApp update, and records that the attendant agreed. **Built:** a checkbox on the form's patient details, shown once an attendant phone is entered and unchecked by default. The time is stored in `patient_details.attendant_consent_at` (server only). Without it the family gets no WhatsApp message and no call, including the missed-call callback; the receiving hospital and the doctor are told as usual.
- **Minimisation:** the note field blocks phone and ID numbers; the board and events never show identifiers.
- **Access:** server-only tables; RLS everywhere; organisation-scoped policies and sign-in before any pilot.
- **Logs:** never log message bodies, `patient_details` or full transcripts in application logs.
- **Processors:** Bolna (voice), Supabase (database), Vercel (hosting) and the WhatsApp provider process data on your behalf. Bolna offers Indian server routing and data residency options for enterprise **[B21]**; check what your plan provides before a pilot.

---

## 4. Calling practices

| Topic | Practice |
|---|---|
| AI disclosure | First sentence of every call (see the welcome messages) |
| Recording disclosure | In the welcome message. For tests, also covered by the consent above |
| Calling hours | Emergencies are 24×7, so Bolna's calling-hours guardrail stays off and each call sends `bypass_call_guardrails: true` **[B10]**. Only ever call hospital emergency lines this way |
| Caller ID | One Indian number used consistently; attach the inbound callback agent so returned calls reach the doctor |
| Family calls | Only to an attendant who agreed, and only after the hold is confirmed |
| Telecom rules | TRAI's telemarketing rules target commercial communication. These are non-commercial service calls to institutions, but take advice before scaling, and never use the system for promotion |

---

## 5. Clinical safety

- **Templates are defaults, not medical decisions.** `case_templates.clinician_reviewed = false` until a doctor reviews them; show "not clinician-reviewed" in the UI until then.
- **Uncertainty is visible:** `unclear` and `needs_review` outcomes are orange, show the recording, and can't be selected without an explicit override.
- **Graceful degradation:** if calls fail, the doctor gets a ranked tap-to-call list; the system never leaves them with nothing.
- **Failure-mode review** before the demo: false accept · missed acceptance · wrong hospital called · identifier leaked · call never ends · duplicate waves. Each one maps to a test in `05-voice-agents.md` §9 or a database guard (`03-data-model.md` §5.4).

---

## 6. Security checklist

- [ ] Function routes reject requests without the bearer secret.
- [ ] Webhook route requires its token; raw payloads logged server-side only.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `BOLNA_API_KEY` never reach the browser (check the client bundle).
- [ ] RLS enabled on every table; `patient_details`, `messages` and `bolna_webhook_log` have no client policies (tested; see `03-data-model.md`).
- [ ] zod validation on every route; unreplaced `%(name)s` tokens treated as missing.
- [ ] Rate limits on redial (2 per facility per referral) and on referral creation.
- [ ] Passcode on the console for the demo; Supabase Auth before any pilot.
- [ ] Demo data is fictional and marked `is_demo`; real phone numbers only for consenting people.

---

## 7. One-paragraph ethics statement (for the deck or README)

> Haazir only calls hospital emergency lines, always says it is an automated assistant working for a named doctor, and never shares a patient's identity until a hospital has agreed to accept them. It records answers so that referrals are accountable, never makes medical decisions, never takes money for ranking, and leaves the final choice to the doctor. All testing was done with consenting hospitals and doctors, using clearly labelled calls and fictional patients.
