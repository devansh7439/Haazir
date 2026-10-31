# CLAUDE.md · Haazir

Instructions for AI coding assistants (Claude Code, Cursor, Codex) working in this repo. Put this file at the repo root.

## What this is
An emergency referral router. A doctor submits a referral; we phone capable hospitals **in parallel** through Bolna voice agents; hospitals' answers are written to our database **mid-call** through Bolna custom functions; a live board shows outcomes; the doctor selects a hospital; we confirm the hold, send a WhatsApp handoff and release the others.

Read first: `docs/01-product-blueprint.md` (what and why), `docs/02-architecture.md` (how), `docs/04-api-spec.md` (contracts), `docs/05-voice-agents.md` (Bolna).

## Stack
Next.js App Router + TypeScript (strict) · Tailwind + shadcn/ui · Supabase Postgres + Realtime (`@supabase/supabase-js`) · zod · react-leaflet with OpenStreetMap tiles · Vercel.

## Commands
```bash
bun run db:setup     # apply supabase/migrations/* + seed to DATABASE_URL (pglite:./.data/pglite needs no setup)
bun run dev          # local app on :3000 (dev mode is 6–12× slower than production)
bun run serve        # production build + start: use for demos, rehearsals and latency checks
bun run lint && bun run typecheck && bun run test   # not `bun test`: tests use vitest
ngrok http 3000      # public URL for Bolna callbacks; put it in APP_BASE_URL and in the DEV agents
```

## Non-negotiable rules
1. **No patient identifiers** in availability-call `user_data`, `events.payload`, logs, or any response to the browser. Identifiers live only in `patient_details` and `messages`, which are server-only.
2. **Monotonic statuses.** Never move a `call_attempts.status` backwards. Read transcript, recording and `extracted_data` only at Bolna status `completed`.
3. **Function routes (`/api/bolna/functions/*`) always return 200 with an `instruction` string**, even on internal errors, and respond fast. Auth: `Authorization: Bearer ${BOLNA_FUNCTION_SECRET}`.
4. In function payloads, treat `""`, `"None"`, `"null"`, `"undefined"` and unreplaced `%(name)s` as missing. Every value arrives as a string.
5. Dispatch a wave only after the **atomic claim**: `update referrals set current_wave = current_wave + 1 … where id = $1 and current_wave = $2 returning …`.
6. The spoken case summary is built **deterministically** in `lib/modules/referral/summary.helper.ts`, never by an LLM.
7. Server-only secrets: `BOLNA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BOLNA_WEBHOOK_SECRET`, `BOLNA_FUNCTION_SECRET`. Never import server modules into client components.
8. Simulation runs through the **same handlers** as real webhooks and functions (`lib/modules/demo/simulator.service.ts`), with `outcome_source = 'simulation'`.
9. Validate every route body with zod.
10. Never record `accepted` from ambiguous data. When the function result and extraction disagree, set `needs_review`.

## Decisions made while building (differences from the pack)
- **Server data access is raw SQL** in `*.repository.ts` files only, through `lib/core/db.ts` (`DATABASE_URL`: Supabase pooler, any Postgres, or `pglite:` for tests and zero-setup dev). The browser uses Supabase only for Realtime (anon key). Reason: the tested eligibility query and the atomic wave claim run unchanged, and integration tests run on a real Postgres.
- `supabase/migrations/0002_guards.sql` adds unique indexes so concurrent `EvaluationService.evaluate` runs can't double-dispatch redials, releases or once-only events, plus a server-only `app_settings` table.
- All timestamps come from `lib/core/clock.ts` (never SQL `now()`), so tests drive time.
- **Organisations.** Every console route calls `requireSession()` and loads rows through `ScopeService` (`lib/modules/auth/scope.service.ts`: `referral`, `attempt`, `facility`, `contact`); list queries filter by `s.org`. New tables that the console reads need an `org_id` (children inherit it by trigger; see migration 0003). Bolna, cron, WhatsApp and trigger routes authenticate with their own secrets or signatures.
- Migrations are tracked in `haazir_migrations`; `bun run db:setup` (and the embedded DB on connect) applies only new files.
- `WebhookService.recoverStale` re-reads stuck calls from Bolna; `MaintenanceService.tick` is the background loop.
- **Safety rules added after a devil's-advocate review** (tests in `tests/adversarial.test.ts`): function routes only accept an id for the right kind of call; "accepted" with bed `none` goes to review; a yes after the patient is placed is released on the same call (`CallService.recordInCallRelease`); no TTFA after cancel/close; at most two redials or callbacks per hospital, then the doctor is asked to call; family-call transcripts and recordings are never stored; `parseBody` requires `application/json`; `ReferralService.create` is idempotent on `client_request_id`.
- Handlers return `{ instruction, followUp }`; routes run `followUp` with `after()`, the simulator awaits it.
- No shadcn/ui: a small in-house design system instead. Tokens and component classes (`btn`, `card`, `input`, `chip`, `tag`) live in `app/globals.css` (monochrome: near-black `brand-*` accent, zinc neutrals, every other hue mapped to zinc; `line` hairline border, Inter). Primitives are in `components/ui.tsx` (`StatusPill`, `PageHeader`, `Stat`, `SectionTitle`, `Logo`), with `lucide-react` line icons. Never use emoji as icons; every status shows an icon or dot plus text.

## Bolna essentials
- Base URL `https://api.bolna.ai`; header `Authorization: Bearer <BOLNA_API_KEY>`.
- `POST /call` → `{ status: "queued", execution_id }`. Body: `agent_id`, `recipient_phone_number`, `from_phone_number?`, `user_data`, `agent_data.language`, `bypass_call_guardrails: true`. Don't use `retry_config` or `scheduled_at` (minute-level delays; `scheduled_at` rounds up to 10 minutes).
- `POST /call/{execution_id}/stop` works only for queued or scheduled calls.
- `GET /executions/{execution_id}` recovers a missed webhook.
- Statuses: `queued, initiated, ringing, in-progress, call-disconnected, completed, no-answer, busy, failed, canceled, stopped, error, balance-low` (also `scheduled`, `rescheduled`).
- Webhooks and function calls come from `13.203.39.153`, `13.126.9.249`, `13.202.133.53`.
- Custom function `param` values use `%(name)s`; POST sends `param` as a JSON body. Prompt variables passed in `user_data` (like `attempt_id`) are auto-filled into `param`.
- `POST /v2/agent` returns 201 with `state` (not `status`); `toolchain.pipelines` is an array of arrays.
- Full gotchas: https://www.bolna.ai/docs/AGENTS.md · Bolna Skills: `npx skills add bolna-ai/skills -a claude-code`.

## Where things are
| Path | What |
|---|---|
| `supabase/migrations/0001_init.sql`, `supabase/seed.sql` | Schema (tested on Postgres 16) and demo data |
| `bolna/prompts/*.md`, `bolna/tools/*.json`, `bolna/extractions.md` | Agent prompts, tool definitions, extraction setup |
| `scenarios/demo-krait-bite.json` | Simulation and stage-demo script |
| `context.md` | Code-quality rules and the refactor plan: read it before changing code |
| `lib/core/` | Config, clock, db, `ApiError`, logger, route helpers (`parseBody`, `handle`), normalisers, row types |
| `lib/integrations/` | Bolna (client, auth, agent builder), WhatsApp (send, inbound signatures and parsing), Sarvam, Supabase browser client |
| `lib/modules/<area>/` | One file per layer: `*.repository.ts` (all SQL), `*.service.ts` (the steps), `*.helper.ts` (pure rules), `*.type.ts`, `*.validation.ts` |
| `lib/modules/referral/` | `ReferralService` (create, cancel, close, widen), `HoldService` (select, hold, confirm, handoff); `referral.helper.ts` `planEvaluation` plans the steps of `docs/02-architecture.md` §6.3, `EvaluationService.evaluate` applies them; browser view; spoken summary |
| `lib/modules/call/` | Placing calls (waves, redials, releases, holds, family calls), Bolna status webhook and mid-call functions, status map, `user_data` |
| `lib/modules/facility/` | Directory, eligibility SQL (`facility.repository.ts`) and ranking (`matching.helper.ts`, `docs/02-architecture.md` §7) |
| `lib/modules/{handoff,intake,portal,analytics,maintenance,demo,auth,event,setting}/` | WhatsApp handoff, WhatsApp intake, portal flags, analytics, cron and purge, Demo page and simulator, sign-in and org scope, audit events, settings |
| `lib/ui/display.ts` | Client-safe display helpers (tones, labels, timeline text) |

## Unverified against live services
Bolna's v2 agent payload (`lib/integrations/bolna/bolna.agents.ts`), the execution-polling response shape, Sarvam speech-to-text (`lib/integrations/sarvam/sarvam.stt.ts`), and Meta/Twilio WhatsApp sends were written without access to those docs or accounts. Each file says so; test them before relying on them.

## Tests to write first
- `summary.ts`: the krait-bite example produces exactly the string in `docs/02-architecture.md` §8; a note with 10 digits is rejected.
- `statusMap.ts`: out-of-order and duplicate webhooks never move an attempt backwards.
- Function payload normaliser: `%(bed_type)s`, `"None"` and `""` become `null`.
- Matching on seed data returns Tamarind, Banyan, Neem, Jasmine, Mango Grove, Lotus, in that order, with ETAs 18, 35, 37, 46, 55, 74.
- Privacy: availability `user_data` never contains `patient_name`, `attendant_name` or `attendant_phone`.
- Integration: a simulated `demo-krait-bite` referral reaches `confirmed`, with exactly two release calls (Banyan, Mango Grove).

## Style
Follow `context.md` §2 (layers, errors and logging, comments, formatting, tests, components). In short: thin routes, services that order the work, repositories that hold the SQL, pure helpers with unit tests. Server components for data loading; client components only for realtime, the map and forms.
