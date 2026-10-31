# Haazir · Build Pack

Everything you need to start building **Haazir** (working name), an emergency referral router for the **Bolna Symphony Buildathon 2026**.

> When a small hospital can't treat a critically ill patient, Haazir phones every capable hospital nearby at the same time, in their language, and hands the doctor a confirmed bed with a recorded, timestamped answer.

---

## Reading order

| # | File | Who should read it | What's inside |
|---|---|---|---|
| 1 | `01-product-blueprint.md` | **Everyone** | Problem, evidence, insights, users, scope (MoSCoW), metrics, positioning, business, risks, where you stand vs other entrants |
| 2 | `07-build-plan.md` | **Everyone** | Day-0 checklist, roles, milestones, 35 tickets with acceptance criteria, 7-day and 3-day plans, cut list |
| 3 | `02-architecture.md` | Backend, frontend | Stack, flows, state machines, orchestrator pseudo-code, matching, summary builder, realtime, simulation, security, Bolna constraints |
| 4 | `03-data-model.md` | Backend | Tables, enums, privacy design, tested reference queries, demo directory |
| 5 | `04-api-spec.md` | Backend, frontend | Every route with request and response examples, Bolna webhook and function contracts, WhatsApp templates, events |
| 6 | `05-voice-agents.md` | Voice lead | Agent settings, `user_data`, languages, conversation rules, edge cases, 20-scenario test matrix |
| 7 | `06-ui-spec.md` | Frontend | Screens, status language, behaviour, accessibility |
| 8 | `08-demo-and-pitch.md` | Pitch lead | 3-minute script, judge cards, stage checklist, fallback ladder, deck outline, 20 hard questions with answers |
| 9 | `09-validation-safety-compliance.md` | Pitch lead, everyone | Interview scripts, consented test-call protocol, hard rules, DPDP, security checklist |
| 10 | `10-research-and-sources.md` | Anyone checking a claim | Evidence, competitor landscape, field scan, Bolna facts used, all links |

**Starter files**

| Path | Use |
|---|---|
| `CLAUDE.md` | Put at the repo root for AI coding assistants |
| `.env.example` | All environment variables |
| `supabase/migrations/0001_init.sql` | Full schema with RLS and realtime |
| `supabase/seed.sql` | Capabilities, case templates and a fictional Bengaluru demo directory |
| `bolna/prompts/*.md` | Welcome messages (English, Hindi, Kannada) and system prompts for each agent |
| `bolna/tools/*.json` | Custom function definitions to paste into Bolna |
| `bolna/extractions.md` | Post-call extraction setup |
| `scenarios/demo-krait-bite.json` | Stage-demo and simulation script |

---

## Your first two hours

1. Fill in `07-build-plan.md` §0 from the buildathon page: deadline, submission format, judging criteria.
2. **Check your Bolna concurrency.** A trial account allows 2 concurrent calls to verified numbers only; you need about 10 for the demo.
3. Create the Supabase project and run `0001_init.sql`, then `seed.sql`.
4. Scaffold the Next.js repo; copy this pack into `docs/` and `bolna/`; put `CLAUDE.md` at the root.
5. Build the Availability agent from `bolna/prompts/availability.md` and `bolna/tools/record_hospital_response.json`.
6. Aim for **milestone M1** by end of day 1: one button → one call → a tester says yes → the card turns green **while the call is still live**.

---

## Decisions already made
- **Stack:** Next.js (Node server behind an ngrok/cloudflared tunnel), Supabase (Postgres + Realtime), Bolna, Leaflet with OpenStreetMap, zod.
- **Doctor callback** instead of live transfer (a per-call transfer destination isn't documented in Bolna). A fixed-number transfer is optional for the stage demo.
- **Our own scheduler** for waves, redials and callbacks (Bolna's `scheduled_at` and `retry_config` work in minutes).
- **No patient identifiers** on availability calls; identifiers go to the accepting hospital on WhatsApp.
- **Simulation mode** through the same handlers, as both a dev accelerator and the stage fallback.

## Still open (see blueprint §15)
Name · first buyer · which hospital or doctor consents to test calls · WhatsApp provider · real dates and judging rubric.

---

## What was checked
- The schema and seed were run on **PostgreSQL 16**: the eligibility query returns the six expected demo hospitals with the stated ETAs; referral codes, metrics views, the atomic wave claim, check constraints, cascade deletes and the `updated_at` trigger were exercised; RLS hides `patient_details` and `messages` from the browser role. Supabase-only parts (the realtime publication and its built-in roles) can only be confirmed in a Supabase project.
- All JSON files parse, and every tool's `param` keys match its declared parameters.
- Cross-references between docs (files, sections, source IDs, env vars, status and outcome names) were checked by script.
- Mermaid diagrams were checked by hand (the Mermaid library couldn't be installed here). If one fails to render, wrap its labels in quotes.
- Bolna API details come from Bolna's documentation as of 28 Oct 2026 (links in `10-research-and-sources.md`). Re-check anything marked "verify" on day 1.
- Hindi and Kannada lines were drafted for you. **Have a native speaker review them** before the demo.
