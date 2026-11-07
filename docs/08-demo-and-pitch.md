# 08 · Demo and Pitch

A 3-minute script, printable judge cards, a stage checklist, a fallback ladder, a deck outline and answers to the hardest questions.

---

## 1. The 3-minute script

| Time | On screen | Say (roughly) |
|---|---|---|
| 0:00–0:20 | Title slide | "2 a.m., a primary health centre near Hoskote. A farmer bitten by a krait: drooping eyelids, can't swallow. He'll need a ventilator soon. The PHC has none. So the doctor starts dialling, one hospital at a time." |
| 0:20–0:40 | Evidence slide | "This July, the Delhi High Court ordered an audit of 38 hospitals after a patient was turned away from an ICU while the portal showed beds free. Bengaluru had the same failure in 2021. **Dashboards show what a hospital typed yesterday. Haazir asks them now.**" |
| 0:40–0:55 | Console: new referral | Fill the form live: Snakebite → needs pre-fill → Critical, 34, male, note. "This is exactly what hospitals will hear. No name, no phone number." Click **Find a bed**. |
| 0:55–1:55 | Live board; six phones ringing on stage | "Six capable hospitals, called at once, each in its own language, including Kannada." Point at pins turning as the judges answer. When Jasmine's banner appears, tap **Call desk** on your phone; card 4's phone rings. When the first green appears: "First yes in **{TTFA}** seconds." |
| 1:55–2:15 | Select Tamarind | "Tamarind is 18 minutes away and only wants the case sheet." Select → confirmation call in Kannada → the WhatsApp note arrives on card 1's phone and the family's phone → "And the two hospitals we didn't pick are told right away, so their beds go back to the next patient." |
| 2:15–2:40 | Proof slide | "We ran **{N}** consented test calls with **{hospital or doctors}**. Median time to a confirmed answer: **{X}** seconds." Play a 10-second clip. One doctor quote (with permission). |
| 2:40–3:00 | Business slide | "Voice is one part of the product, not the product: the referral workflow is. Ambulance operators pay per placement. Ranking is never for sale. Next: a pilot with {name}." |

**Rules:** only say numbers you measured. If a phone doesn't ring, keep going: "that's what a no-answer looks like, and it's why we call six."

**Status line, said once and shown on the title and last slides:** "Pilot-ready, not deployed." Haazir has not run with a hospital in production.

**Filling the `{…}` placeholders (here and in section 6):** take `{N}`, `{X}`, `{TTFA}`, `{answer rate}` and the cost from Analytics with "real hospitals only" on, never from the demo hospitals or a rehearsal. Check outcomes against recordings before quoting an accuracy. A figure you can't source, drop; don't round it up.

**If there are no measured runs by demo day, use this instead of the proof row:** "We haven't yet run this with real hospitals; it is pilot-ready, not deployed. The board already measures what a pilot needs to prove: time to the first confirmed answer, how often desks pick up, and cost per referral. Here is a call we recorded with a consenting team phone." And on the business row: "Next: a pilot. We are talking to {ambulance or 108 operator} / we are looking for one." Say only what is true.

**Scope in the pitch.** The demo is the loop: find → hold → hand off → release, plus the arrival check as a one-line mention. Family *calls*, voice-note intake and the mobile app are roadmap: say so if asked (Q17), don't demo them. The family WhatsApp in the handoff is part of the loop and stays.

---

## 2. Judge cards (print one per phone; number each phone with a sticker)

> **Card 1 · Tamarind District Hospital · casualty desk · needs a Kannada speaker**
> Answer **in Kannada**. You have an ICU bed with a ventilator free. **Accept, with a condition:** "ರೋಗಿಯ ಜೊತೆ ಪಿಎಚ್‌ಸಿ ಕೇಸ್ ಶೀಟ್ ಕಳುಹಿಸಿ" (send the PHC case sheet with the patient). Ready in 10 minutes. Your name: **Dr Shashikala**.
> A minute later you'll get a confirmation call: say **yes**, keep the bed ready. Then check WhatsApp.

> **Card 2 · Banyan Multispeciality Hospital · casualty desk · English**
> **Accept.** ICU bed with ventilator free, ready in 10 minutes, ask for **Dr Kiran**.
> Later you'll get a short call saying the patient went elsewhere: just say "OK, thanks".

> **Card 3 · Neem Trauma & Neuro Centre · English**
> **Decline:** "Sorry, our ICU is full, no ventilator free."

> **Card 4 · Jasmine Heart Institute · English**
> Before deciding, ask: **"Can I speak to the referring doctor? Is the patient intubated?"**
> The doctor will call you back on stage. Answer and chat for 10 seconds.

> **Card 5 · Mango Grove Medical College Hospital · English**
> Say **"Hold on, let me check the ICU."** Stay silent for about 10 seconds. Then **accept:** ICU with ventilator, ready in 20 minutes, ask for **Nurse Priya**.
> Later you'll get a short call saying the patient went elsewhere.

> **Card 6 · Lotus Burns & Plastic Centre**
> **Don't answer** when it rings.

> **Doctor phone (presenter):** receives the confirmation WhatsApp; calls card 4 back from the banner.
> **Family phone (volunteer):** receives the Kannada WhatsApp message.

Use phones **you control** (team, friends). Don't depend on collecting judges' numbers on the day. Hand each judge a phone with a card.

### Safety-net variants (use one or both; rehearse them, neither is guaranteed to fire)

> **Card 3, "changes mind" variant · Neem Trauma & Neuro Centre**
> Say **"Yes, we can take him, ICU with a ventilator."** Wait for the read-back, then say **"Sorry, no: the last ventilator just went to another patient."**
> What it shows: if the call's recorded answer and the post-call transcript disagree, the card turns orange, **Check the recording**, and Select stays locked until the doctor listens (CLAUDE.md rule 10). The agent is told to read back before recording, so it may record your final "no" and nothing fires. If it doesn't, show the flagged call from the rehearsal run. `tests/flow.test.ts` proves the mechanism.

> **Card 6, "calls back" variant · Lotus Burns & Plastic Centre**
> Don't answer the first call. Then ring the Haazir caller-ID number and say **"This is Lotus, about R 4821, we can take the patient now."**
> What it shows: the inbound agent matches the call to the referral and the board shows **Lotus called back** with a tap-to-call link. Needs `BOLNA_AGENT_ID_INBOUND` attached to that number.

---

## 3. Stage checklist (T-30 minutes)

- [ ] Bolna wallet topped up; concurrency 10 or more; demo agents point at the production URL.
- [ ] Hospitals page → each demo hospital's desk number set to a phone you control → one test call per phone from the Bolna dashboard answered.
- [ ] All phones charged, volume max, silent and Do Not Disturb off, unknown callers allowed, numbered stickers, cards attached.
- [ ] WhatsApp: every demo phone has messaged your WhatsApp number in the last 24 h (or use `none` with previews on screen).
- [ ] Laptop on a reliable connection, plus a backup hotspot. Browser zoom 125%. Notifications off.
- [ ] Backup video on the desktop.
- [ ] `FAMILY_CALLS=off` in the demo environment (family calls are roadmap, so no phone should ring for them).
- [ ] Rehearsed three times with the same people holding the same cards.

---

## 4. Fallback ladder

| What fails | Do this | Say |
|---|---|---|
| One phone doesn't ring | Carry on | "No answer: that's why we call six at once." |
| A call goes off-script | Carry on; the board shows the honest outcome | "This is a live call." |
| Telephony or Bolna down | Open a finished referral from this morning's rehearsal, then play the backup video | "The network's down, so here's the board and the recording from this morning's run." |
| Laptop or network dead | Play the backup video | "Here's the run we recorded an hour ago." |

---

## 5. Deck outline (10 slides)

1. **Title:** Haazir · one-line pitch · tagline
2. **2 a.m.:** the story, in text, no stock photos
3. **The failure, twice:** Delhi 2026 audit and Bengaluru 2021, with sources
4. **The insight:** pull, not push; store capability, ask availability
5. **The product:** the loop diagram; "the AI is one part"
6. **Live demo**
7. **Proof:** consented test calls, median TTFA, answer rate, one quote
8. **Trust by design:** no identifiers on first call · read-back · recorded and disclosed · doctor decides · holds expire · no paid ranking
9. **Why Bolna:** parallel outbound calls, Kannada/Hindi with mid-call switching, mid-call functions writing to our system, extractions as a second check, webhooks driving the board. Name the feature behind each job:

   | Job | Bolna feature |
   |---|---|
   | Ring six hospitals at once, in their language | Outbound API calls, per-call `agent_data.language`, multilingual switching |
   | Write the answer while the call is live | Custom functions (`record_hospital_response`, `record_hold_confirmation`, `record_arrival`) |
   | Answer "is he intubated?" without a callback | The prompt with per-call `user_data` (`known_facts`) and the knowledge base for desk FAQs |
   | Catch a wrong or doubtful answer | Post-call extractions compared with the function result (`needs_review`) |
   | Take a hospital's call back | Inbound agent |
   | Keep the board current | Status webhooks; `GET /executions` to recover a missed one |
   | Cost and call length for the proof slide | The `completed` webhook (`total_cost`, `conversation_duration`; unverified fields) |
10. **Business and next steps:** buyer, unit economics (calls per referral), pilot ask, team. Footer on this slide and the title: "Pilot-ready, not deployed." Roadmap strip: family calls, voice-note intake, mobile app, WhatsApp quick replies

### Optional slide after 8: "What a casualty doctor would ask us"

One line each. Say "built" only for what a test or a real call has shown; everything else is "next".

| A doctor asks | Today | Next |
|---|---|---|
| "Is he intubated? What's the SpO₂ and GCS?" | The form takes airway, SpO₂, GCS and oxygen; they are read to every desk and the agent answers follow-ups from them, never guessing (`known_facts`). Not yet shown on a real call | Run the question on consented test calls and report how often the desk still asked for a doctor |
| "Is it free? Ayushman? Is it medico-legal?" | Payer and the medico-legal flag are given to the agent to answer if asked. The agent never discusses fees or deposits | Learn from the pilot which questions desks actually ask |
| "How long is the drive, really?" | Straight line × 1.4 at 30 km/h; road times from an OSRM server when `ROUTING_BASE_URL` is set (unverified against a live server) | Ambulance availability and traffic; the 108 operator's own ETA |
| "Did the patient actually get in?" | The doctor marks "arrived" by hand, and an arrival-check agent phones the chosen hospital once at ETA + 10 min and records yes or no (tested against the fake Bolna; the agent is not yet created or heard on a real call) | Report how often the desk's answer matched what happened; a bounce rate per hospital |
| "What if nobody says yes?" | The ranked tap-to-call list, a wider search, one-tap 108 / 112, and the three nearest hospitals with a casualty desk number to stabilise at (straight-line ETA, not road time) | An admin can list escalation numbers (district referral officer, state referral hospital); they appear as call buttons beside 108 / 112 (web board only; none are seeded). Check with doctors that "has a casualty desk number" is the right test for an emergency department, and that a phone number is enough escalation |
| "Can I talk to their doctor?" | A callback request with a banner; live transfer works on the demo agent only | A fixed bridge number that rings the active referral's doctor (untested) |

---

## 6. Hard questions and answers

| # | Question | Answer |
|---|---|---|
| 1 | "Delete the voice agent. What's left?" | The referral workflow: capability directory, matching, live board, hold and release, audit trail, WhatsApp handoff. Without voice, someone is back to dialling eight numbers by hand; that's the one job the agent replaces. |
| 2 | "You started with blood donors and ended with snakebite. Chasing sympathy?" | Same principle, voice inside a product. Referral is where the emergency stalls once it starts. Snakebite is the demo case; the product handles any time-critical referral (head injury, heart attack, sick newborn). |
| 3 | "The Delhi hospital lied. Your bot gets the same lie." | Two problems. Stale data: a live call fixes it. Deliberate refusal: a call can't force acceptance, but it creates a timestamped, recorded answer with a named person, which is exactly what the court's audit is trying to reconstruct. Over time, acceptance rates per hospital become visible. We shorten the search and add accountability; we don't claim to end refusals. |
| 4 | "Phones get answered? The Delhi helpline didn't." | A helpline is one human for many callers. We call desks directly, in parallel, redial on busy, try alternate numbers, and score numbers by answer rate. Our validation measured {answer rate}. If nobody answers, the doctor still gets a ranked tap-to-call list. |
| 5 | "58,000 snakebite deaths: how many does your product touch?" | We don't claim any. It explains why snakebite needs particular hospitals (ventilator, ICU). Our metric is time to a confirmed bed, and we report what we measured. |
| 6 | "You'll spam overworked desks." | At most 6 calls per wave, each under a minute, no repeat calls, release only to those who accepted, opt-out honoured. In 2021, volunteers re-called hospitals over and over to verify leads; one structured call can replace that churn. |
| 7 | "Isn't 'hold the bed' the Bengaluru bed-blocking racket?" | That abuse came from beds blocked in the names of patients who never came. Our holds are tied to a real referral and doctor, expire automatically (ETA + 30 min), allow one active hold per referral, are recorded and logged, and never involve money or agents. |
| 8 | "Patient data, DPDP?" | Availability calls carry no identifiers: only age, sex, condition and needs. Identifying details go only to the hospital that accepted, on WhatsApp. Calls disclose AI and recording. The DPDP Rules were notified in November 2025 with phased obligations, and we design for consent and minimisation now. |
| 9 | "It hears 'nahi' as 'haan' in a noisy ward." | Read-back before recording; an independent post-call extraction cross-checks every answer; conflicts are flagged "check recording" and can't be selected; the chosen hospital gets a confirmation call; the doctor can hear the recording. Zero false accepts in our {N}-run test matrix. |
| 10 | "Aapat Setu already does this." | Aapat Setu sends the file to a hospital you've already chosen; we find which hospital will take the patient now. It needs registered hospitals; we need a phone number. They fit together: our handoff can carry an Aapat Setu link. |
| 11 | "Why Bolna and not Twilio plus an LLM?" | Concurrent outbound calls through one API, Indian-language speech with mid-call switching, tool calls that write to our system during the call, extractions, recordings and status webhooks. Building that ourselves would be weeks of telephony and latency work instead of product work. |
| 12 | "'Two to three minutes', measured how?" | TTFA = referral submit → first recorded acceptance, logged per referral. Our measured median across {N} consented runs was {X}. |
| 13 | "Where do the direct casualty numbers come from?" | Seeded from public sources and doctors' own contacts, verified by the first call, scored by answer rate; IVR-only lines are flagged. The directory gets better with every call. That's the moat. |
| 14 | "Who pays? Doesn't that steer patients to payers?" | Ambulance and emergency-response operators pay per placement. Ranking uses only capability, distance and track record; it's never for sale, and that's a stated principle. |
| 15 | "Name one casualty doctor you spoke to." | {Name, role, hospital — with permission}, plus {2 more}. What they told us: {one line}. |
| 16 | "The demo is theatre; judges are cooperating." | Yes, and we say so. Here's a recorded call with {consenting hospital}, unscripted on their side. The judge cards just let you see every outcome in three minutes. |
| 17 | "Too much scope." | The MVP is the loop: find → hold → hand off → release. Family calls, voice-note intake, the mobile app and WhatsApp quick replies are on the roadmap, not in the demo. Pilot-ready, not deployed. |
| 18 | "The name sounds like an attendance app." | {Final name}. Haazir means "present", which is what we ask hospitals to be. |
| 19 | "What if hospitals start ignoring your number?" | Indian caller ID, a named doctor in the first sentence, calls under a minute, prompt releases, and we track answer rates per number so we see it early. A hospital can also choose a WhatsApp quick reply instead (roadmap). |
| 20 | "Cost per referral?" | About 6–9 short calls per placed referral (6 availability, 1 confirmation, up to 2 releases). {Fill in from your Bolna per-minute rate.} |
| 21 | "A desk asks 'is he intubated?' and your bot has no idea." | The doctor can enter airway, SpO₂ and GCS; they are read in the summary, and the agent answers follow-ups only from those facts. If the doctor left one out, the agent says it wasn't given and offers the doctor's callback. It never guesses. |

**Never say:** "AI saves lives", "we prevent deaths", "hospitals can't refuse", "real-time bed data" (we ask, we don't hold data), "guaranteed bed", "HIPAA" (wrong country; say DPDP).
