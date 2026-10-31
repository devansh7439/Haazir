# 06 · UI Specification

Four screens: **New referral**, **Live board**, **Facilities**, **Demo**. Built with Next.js, Tailwind, shadcn/ui, and Leaflet with OpenStreetMap tiles.
The design goal: a tired doctor at 2 a.m. can start a referral in 30 seconds and understand the board at a glance.

---

## 1. New referral (`/`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Haazir · Dr. Meera Rao, Hoskote PHC                         [Demo] [History] │
├─────────────────────────────────────┬────────────────────────────────────────┤
│ NEW REFERRAL                        │ WHAT HOSPITALS WILL HEAR                │
│ Case   [Snakebite–neuro] [Head inj] │ "Man aged 34, suspected snakebite with  │
│        [Heart attack] [Stroke]      │  neurotoxic signs, critical. Drooping   │
│        [Newborn] [Obstetric] [More] │  eyelids and trouble swallowing 2 hours │
│ Needs  [ICU bed ✓] [Ventilator ✓]   │  after bite. Given 10 vials of anti-    │
│        [+ add need]                 │  snake venom. Needs an ICU bed and a    │
│ Acuity (● Critical ○ Serious ○ Stable)  ventilator."                         │
│ Age [34] [years ▾]   Sex [Male ▾]   │                                        │
│ Note [Drooping eyelids and trouble…]│ 6 HOSPITALS WILL BE CALLED             │
│      ⓘ No names, phone numbers or IDs │ 1 Tamarind District · 18 min · Kannada │
│ ▸ Patient & family (shared only     │ 2 Banyan Multispeciality · 35 min      │
│   after a hospital accepts)         │ 3 Neem Trauma & Neuro · 37 min         │
│ Radius [40 km ▾]                    │ … why each: "has ICU bed + ventilator" │
│                                     │                                        │
│ [        Find a bed        ]        │                                        │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Case chips | Selecting one pre-fills **Needs** from `case_templates`. The doctor can add or remove needs |
| Needs chips | From `capabilities`; selected ones are ticked |
| Note | 160-character counter. Inline error if the note contains a phone or ID-like number (blocked) or a warning for honorific + name |
| Patient & family (collapsed) | Patient name, attendant name, attendant phone, attendant language. Helper text: "Shared only with the hospital that accepts, on WhatsApp." |
| Right panel | Calls `POST /api/referrals/preview` (debounced 400 ms). Shows the exact spoken summary and the ranked hospitals that will be called, with reasons |
| No eligible hospitals | "No hospital within 40 km has an ICU bed + ventilator. [Widen to 80 km] [Remove a need]" |
| Find a bed | `POST /api/referrals`, then navigate to the live board. Disabled until the case, acuity and needs are set |
| Demo only | A "Run as simulation" checkbox (sends `"simulate": true`) for an instant stage fallback without redeploying |

---

## 2. Live board (`/referrals/[id]`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ R-4821 · Snakebite (neurotoxic) · Critical    ⏱ 01:12   First yes: 0:37   ● Options ready │
├────────────────────────────────┬─────────────────────────────────────────────┤
│                                │ ⚠ Jasmine Heart Institute wants to talk to  │
│            MAP                 │   you (Dr Anil): "is the patient intubated?"│
│   ⌂ Hoskote PHC                │   [☎ Call desk]                             │
│   ① green   ② green            │ ACCEPTED                                    │
│   ③ red     ④ purple           │ ✔ Tamarind District · 18 min · 6.4 km       │
│   ⑤ amber   ⑥ grey             │   ICU + ventilator · ready in 10 min        │
│                                │   Ask for Dr Shashikala                     │
│                                │   Condition: send the PHC case sheet        │
│                                │   [Select]  [☎ Call desk]  [▶ Recording]    │
│                                │ ✔ Banyan Multispeciality · 35 min           │
│                                │   ICU + ventilator · ready in 10 min · Dr Kiran │
│                                │ IN PROGRESS                                 │
│                                │ ◐ Mango Grove Medical College · on call 0:48│
│                                │ NOT AVAILABLE                               │
│                                │ ✖ Neem Trauma & Neuro · ICU full, no ventilator │
│                                │ ⊘ Lotus Burns & Plastic · no answer         │
├────────────────────────────────┴─────────────────────────────────────────────┤
│ TIMELINE 00:00 Referral created · 00:05 Calling 6 hospitals · 00:37 Banyan accepted · … │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Status language (never colour alone: always icon + text)

| State | Colour | Icon | Card text |
|---|---|---|---|
| queued | grey | ○ | Queued |
| dialing / ringing | blue | ☎ | Ringing |
| in_progress, no outcome yet | amber | ◐ | On call · 0:48 |
| accepted | green | ✔ | Accepted |
| conditional | green, amber border | ✔ | Accepted with a condition |
| declined | red | ✖ | Declined · {reason} |
| needs_doctor | purple | ☎ | Wants to talk to you |
| callback_later | slate | ↻ | Calling back at 02:19 |
| redirected | slate | ↪ | Redirected to {number} |
| no_answer / busy / failed | dark grey | ⊘ | No answer / Busy / Call failed |
| ivr_blocked | dark grey | ⊘ | Phone menu: add a direct number |
| unclear or needs_review | orange | ? | Check the recording |
| hold_confirmed | green, solid | 🔒 | Bed held until 03:02 |
| release_ack | grey | ✓ | Released |

### 2.2 Behaviour

| Element | Behaviour |
|---|---|
| Header timer | Counts from `created_at`. **First yes** shows TTFA once it exists; it's the demo's headline number |
| Map | Origin as a house icon; hospitals as numbered circles in status colour; tooltip with name, ETA and status. OpenStreetMap attribution visible |
| Card order | Accepted (by ETA) → In progress → Waiting → Not available |
| Card details | Bed type, ready in, contact, conditions, decline reason, "why chosen" chips, then recording player and expandable transcript after `completed` |
| Live updates | Supabase Realtime; a card updates within 2 s of the function call, **while the call is still live** |
| Alert banner | For `needs_doctor` and `inbound_callback`: hospital, reason, big **☎ Call desk** (`tel:`) button. Stays until the doctor records a manual outcome or dismisses it |
| Select | Enabled for accepted or conditional and not `needs_review`. Dialog: "Send the patient to Tamarind District Hospital (18 min)? Haazir will call to confirm the bed." **[Confirm & call]** **[I already confirmed by phone]** |
| Needs review | Orange outline: "The answer is unclear: listen before selecting." Recording player plus **[Set outcome]** |
| Manual outcome | Small form on each card (outcome, bed type, ready in, contact), for after the doctor's own call |
| Tick | While the referral is active, call `POST /api/referrals/:id/tick` every 5 s (1 s if simulated) |
| Accessibility | `aria-live="polite"` region announces changes ("Banyan accepted"). All actions keyboard-reachable |

### 2.3 After selection: hold panel (replaces the header CTA)

```
🔒 Bed held at Tamarind District Hospital until 03:02 · ask for Dr Shashikala
   WhatsApp: hospital ✓ sent · family ✓ sent · you ✓ sent     (previews are redacted)
   Released: Banyan ✓ · Mango Grove ◐ calling
   [Patient arrived]   [Cancel referral]
```
When the hold expires: "Hold expired. Did the patient arrive? [Arrived] [Close]".

### 2.4 Exhausted

"No hospital accepted after 2 rounds (12 calls). Call these desks directly:" followed by a ranked list with `tel:` buttons and the last known answer for each. Also **[Widen to 80 km and try again]**.

### 2.5 Simulated

A yellow **SIMULATED** badge in the header for any `is_simulated` referral. Never hide it.

---

## 3. Facilities (`/facilities`)

Table: name, kind, call language, capability chips, contacts (count; IVR warning), answer rate, acceptance rate, last called.
Row click opens a drawer with editable fields (location, call language, WhatsApp number, active), capability toggles, and a contact list (role, number, priority, IVR flag, verified date, answered/made).
Empty state: "Add the hospitals you refer to most. A direct casualty or referral-desk number works far better than a reception line."

---

## 4. Demo (`/demo`)

| Section | Content |
|---|---|
| Phones | For each demo hospital: judge card number, phone input, WhatsApp toggle, **[Test call]**. Also the referring doctor's phone and the family phone |
| Pre-flight checklist (static) | Bolna concurrency at least 10 · calling hours off · webhook URL set on demo agents · all phones off silent, unknown callers allowed · WhatsApp recipients have messaged our number · simulation scenario loaded |
| Actions | **[Reset demo]** **[Run live demo referral]** **[Run simulated referral]** |
| Status | Last webhook received (time), last function call (time). Shows whether Bolna can reach the app |

---

## 5. History (`/history`, should-have)

List of referrals with code, case, status, **TTFA**, time to confirmed bed, number of calls, and a simulated flag. Data from the `referral_metrics` view. Use it as the "proof" slide: real numbers from your test runs.

---

## 6. Visual and interaction rules

- Large type: base 16 px, header timer 28 px or more. Tap targets 44 px or more.
- High contrast (WCAG AA), and colour never carries meaning alone.
- Mobile: single column; map collapses to a 160 px strip under a sticky header (timer, status, First yes); Select and Call buttons full width.
- Plain words, written for doctors: "Find a bed", "Calling 6 hospitals", "Accepted", "Wants to talk to you", "Bed held until…". Mention AI only where it is disclosed (the calls themselves, which open by saying so).
- Never show patient identifiers on the board. Message previews are redacted ("Patient: ●●●●").
