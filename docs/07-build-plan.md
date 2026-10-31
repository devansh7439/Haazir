# 07 · Build Plan

What to build, in what order, who builds it, and what "done" means. It assumes a team of 3–4 and a 7-day build; a 3-day version is in §6.

---

## 0. Fill these in first (from the buildathon page)

| Item | Value |
|---|---|
| Submission deadline (date and time, IST) | |
| What to submit (repo? live link? video? deck?) | |
| Judging criteria and weights | |
| Demo slot length (and live or recorded?) | |
| Venue: Wi-Fi and mobile signal for phones? | |
| Bolna credits claimed and concurrency tier confirmed | |

If the judging criteria differ from the assumptions in `01-product-blueprint.md` §14, re-weight the pitch, not the product.

---

## 1. Roles

| Role | Owns | Best fit |
|---|---|---|
| **R1 · Voice lead** | Bolna agents, prompts, tools, languages, telephony, test matrix | Whoever has built Bolna agents before |
| **R2 · Backend** | Supabase, API routes, orchestrator, webhook and function routes, simulator, WhatsApp | Strongest backend engineer |
| **R3 · Frontend** | Form, live board, map, hold panel, demo and facilities pages | Strongest UI engineer |
| **R4 · Proof and pitch** | Doctor interviews, consented test calls, numbers, deck, demo script, judge cards, video | Best communicator. With 3 people, R1 and R3 split this |

---

## 2. Day 0 pre-flight (about 3 hours, together)

- [ ] Fill in §0.
- [ ] **Bolna:** API key; claim credits; **confirm concurrency of at least 10** (Settings → Organisation → Account Info). On a trial account, calls are limited to 2 at a time and to **verified numbers only** **[B9]**.
- [ ] **Bolna:** get an **Indian** caller-ID number and attach it to the agents.
- [ ] **Supabase:** create the project; run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
- [ ] **Vercel:** create the project from the GitHub repo; add env vars from `.env.example`.
- [ ] **Tunnel:** ngrok or cloudflared working on everyone's laptop.
- [ ] **Phones:** collect **8 phones you control** (6 hospital roles, 1 doctor, 1 family). Write the numbers down. WhatsApp installed; unknown-caller blocking off.
- [ ] **Decisions:** name (D1), buyer (D2), WhatsApp provider (D4). See blueprint §15.
- [ ] **Proof:** R4 books 3 doctor interviews and asks at least one hospital or doctor to consent to receive test calls (D3).
- [ ] **Repo scaffold:** Next.js (TypeScript, App Router), Tailwind, shadcn/ui, `@supabase/supabase-js`, `zod`, `react-leaflet` + `leaflet`. Copy this pack into `docs/` and `bolna/`, and `CLAUDE.md` to the repo root.

---

## 3. Milestones

| Milestone | Day | Exit test (show it working) |
|---|---|---|
| **M1 Walking skeleton** | 1 | Click a button → Bolna calls one phone → tester says yes → the card turns **green while the call is live**; statuses arrive by webhook |
| **M2 Parallel wave** | 2 | Fill the form → 6 phones ring at once → map and cards update live. A simulated referral plays the whole scenario |
| **M3 Closed loop** | 3 | Select → hold confirmation call → WhatsApp (or simulated) previews → release calls → timeline and TTFA |
| **M4 Robust and multilingual** | 4 | Kannada and Hindi calls; callback, needs-doctor and redirect flows; extraction cross-check; test matrix first pass |
| **M5 Proof** | 5 | 10 or more **consented** real test calls with measured TTFA; 3 doctor interviews; history page with real numbers |
| **M6 Demo-ready** | 6 | Three full rehearsals with judge cards; simulation fallback rehearsed; backup video; submission done |

**M1 is the one that matters most.** If the function call, webhook and realtime chain works on day 1, the rest is product work. If it doesn't, nothing else matters.

---

## 4. Tickets

Estimates are focused hours. "AC" is the acceptance criterion.

### Setup
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-01 | Repo scaffold, lint, typecheck, Vercel preview | R2 | 2 | A preview URL loads |
| H-02 | Supabase schema and seed; server and browser clients | R2 | 1 | Seed rows readable from a page |
| H-03 | Env handling, passcode middleware | R2 | 1 | Console requires the passcode |
| H-04 | Availability agent (dev copy): prompt, 3 tools, webhook | R1 | 3 | Dashboard test call reaches the tunnel |

### M1 · Walking skeleton
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-05 | `lib/integrations/bolna/bolna.client.ts`: `makeCall`, `getExecution`, `stopCall`, types | R2 | 1 | Typed calls; 400 and 429 handled |
| H-06 | Webhook route: auth, raw log, status map, **monotonic** updates | R2 | 3 | Replaying a payload twice changes nothing |
| H-07 | `record-response` route: normalisation, lookup, instruction | R2 | 3 | Outcome is in the DB within 1 s of the tool call; empty or `%(x)s` values handled |
| H-08 | Minimal board: one realtime card | R3 | 3 | Updates without refresh |
| H-09 | Verify `attempt_id` substitution and the `to_number` fallback | R1 | 0.5 | Route logs a real UUID |

### M2 · Parallel wave
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-10 | Form, case and needs chips, preview route, summary builder, identifier guard | R3 + R2 | 5 | Preview text matches `02-architecture.md` §8; a phone number in the note is blocked |
| H-11 | Matching: SQL eligibility, score, reasons, contact choice | R2 | 3 | Seed returns Tamarind, Banyan, Neem, Jasmine, Mango Grove, Lotus |
| H-12 | `POST /api/referrals` with wave-1 dispatch (`allSettled`) | R2 | 3 | Six calls dispatched; one bad number doesn't block the rest |
| H-13 | Map with numbered status pins | R3 | 3 | Pins change colour and icon live |
| H-14 | Simulator plus scenario runner through `tick` | R2 | 4 | `demo-krait-bite.json` plays end to end |
| H-15 | `tick` route and `evaluateReferral` v1 (first acceptance) | R2 | 2 | `options_ready` and TTFA set once |

### M3 · Closed loop
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-16 | Select, hold-confirm agent, `record-hold` route | R1 + R2 | 4 | Referral `confirmed` with `hold_expires_at` |
| H-17 | Release agent and releases in `evaluateReferral` | R1 + R2 | 2 | Every other accepting hospital gets exactly one release call |
| H-18 | WhatsApp adapter (`none`/`twilio`/`meta`), templates, redacted events | R2 | 3 | Messages stored; previews redacted; `none` works offline |
| H-19 | Hold panel, timeline, TTFA in header | R3 | 3 | Matches `06-ui-spec.md` §2.3 |
| H-20 | Confirm-manually, cancel (stop queued calls), close | R2 | 2 | Cancel stops queued calls and releases acceptors |

### M4 · Robust and multilingual
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-21 | Kannada and Hindi config; native-speaker check of all lines | R1 | 3 | Test rows 2–3 pass |
| H-22 | `request-doctor` route and alert banner with `tel:` | R1 + R3 | 2 | Banner in under 2 s |
| H-23 | `request-callback`, callback scheduler, busy redial | R2 | 3 | Rows 7 and 14 pass |
| H-24 | Redirect → new attempt and contact | R2 | 1 | Row 9 passes |
| H-25 | Extractions, reconciliation, `needs_review` UI | R1 + R2 + R3 | 4 | Rows 15, 16 and 20 pass |
| H-26 | Wave 2, `exhausted`, fallback call list | R2 + R3 | 3 | All-decline scenario shows the list |
| H-27 | Test matrix, first full pass | R1 + R4 | 3 | Sheet filled; bugs filed |

### M5–M6 · Proof, polish, demo
| ID | Ticket | Owner | Est. | AC |
|---|---|---|---|---|
| H-28 | Facilities admin page (should) | R3 | 4 | Edit capabilities and contacts |
| H-29 | Demo page: assign numbers, test call, reset, checklist, last-webhook time | R3 + R2 | 3 | A full reset and re-setup takes under 2 minutes |
| H-30 | History page from `referral_metrics` | R3 | 1.5 | Shows TTFA per run |
| H-31 | Three doctor interviews (script in `09-validation-safety-compliance.md` §1.2) | R4 | 3 | Notes plus permission for quotes |
| H-32 | 10 or more consented real test calls; save recordings; compute median TTFA | R4 + R1 | 3 | A number you can put on a slide |
| H-33 | Inbound callback agent and route (should) | R1 + R2 | 2 | Calling our number back raises a banner |
| H-34 | Deck, demo script, printed judge cards | R4 | 4 | `08-demo-and-pitch.md` complete |
| H-35 | Three rehearsals, backup video, submission | All | 4 | Submitted with an hour to spare |

---

## 5. Seven-day schedule

| Day | R1 Voice | R2 Backend | R3 Frontend | R4 Proof and pitch |
|---|---|---|---|---|
| 0 | Pre-flight (all) | Pre-flight | Pre-flight | Pre-flight, book interviews |
| 1 | H-04, H-09 | H-01–H-03, H-05–H-07 | H-08 | Interview script; hospital consent |
| 2 | Prompt tuning on real phones | H-11, H-12, H-14, H-15 | H-10, H-13 | Interviews 1–2 |
| 3 | H-16 and H-17 agents | H-16–H-18, H-20 | H-19 | Deck v1 and story |
| 4 | H-21, H-22, H-25 extraction | H-23–H-26 | H-22, H-25 UI, H-26 | H-27 with R1 |
| 5 | H-32 real test calls | Bug fixes; H-33 | H-28–H-30 | H-31, H-32; numbers into the deck |
| 6 | Rehearsals; fallback | Freeze code at noon | Polish only | H-34, H-35 |

**Daily ritual:** a 15-minute stand-up in the morning, and in the evening, demo the current build to yourselves on real phones. Keep a shared *known issues* list and fix the top three every morning.

---

## 6. If you only have three days

| Day | Goal |
|---|---|
| 1 | M1 plus a simulation-first UI: build the board against the simulator while the voice lead gets one real call working |
| 2 | M2 plus M3 with real calls (WhatsApp simulated); Kannada for one hospital; 5 consented test calls |
| 3 | Test matrix rows 1, 4, 8, 13, 15, 16; two rehearsals; video; submit |

Cut everything in §7 down to the first "never cut" line.

---

## 7. Cut list (cut from the top when behind)

1. Could-haves C1–C8
2. H-33 inbound callback
3. H-28 facilities admin (edit data in SQL instead)
4. H-30 history page (put the SQL output on the slide)
5. H-26 wave 2 (keep `exhausted` and the call list)
6. H-21 Hindi (keep English and Kannada)
7. H-18 real WhatsApp (`none` with previews in the UI)
8. H-25 reconciliation (function-only, no cross-check; anything else is `unclear`)

**Never cut:** the function → webhook → realtime chain · read-back before recording · no identifiers on availability calls · the simulation fallback · consented real test calls (your only proof).

---

## 8. Definition of done

- [ ] A referral created on a phone-sized screen in under 30 seconds triggers 6 parallel calls.
- [ ] Accepted cards turn green **while the call is still live**.
- [ ] Select → hold confirmed → handoff previews → releases; timeline and TTFA visible.
- [ ] Test matrix: 20/20 twice; **zero false accepts**.
- [ ] 10 or more consented real calls with a measured median TTFA; 3 or more doctor interviews.
- [ ] Simulation fallback rehearsed on the demo machine.
- [ ] Live link, repo with README, and a 2-minute video submitted.
