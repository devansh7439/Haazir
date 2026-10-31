# Haazir — Code Quality Context

Shared context for any AI coding assistant (Claude Code, Codex, Cursor, Copilot, …) and for humans. Read this, then `CLAUDE.md`, before changing code. **Last updated: 2026-11-01.**

## How to maintain this file

- Update it right after anything important: a phase finished, a rule agreed, a decision made. Don't batch updates to the end of a session.
- Edit in place; replace stale facts. Only the Changelog is append-only (newest first, one line, absolute dates).
- Keep it terse: rules, paths, decisions. Every line is re-read each session.
- Committed to git (user approved 2026-10-31), so teammates and every session get the same rules. Commit updates to it with the work they describe.

## 1. Goal

The user (Devansh) rated Haazir's code quality "pretty bad" and asked for it to be rewritten in the style of teammate **Divit Periwal**, improving on Divit's weak spots. Reference code: `C:\Users\Devansh\Desktop\marcofed\marcofed`, especially `apps/api/src/modules/core/communication/system-alert.{helper,service,repository}.ts`, `apps/api/src/integrations/sms/sms.integration.ts`, `apps/api/src/integrations/voice/agents/sync.ts` and `apps/api/tests/unit/integrations/sms.integration.test.ts`.

**Behaviour must not change.** The test suite (96 tests, 2026-10-30) is the lock: during the refactor only test imports and call sites may change, never assertions.

## 2. Rules

Each rule says why. Rules marked *(improves Divit)* fix a weak spot seen in the reference code.

### Layers (one file per layer, per module)
- **`app/**/route.ts`**: authenticate (`requireSession()`, or the route's secret or signature), parse the body with zod, call one service method, shape the response. No SQL, no business decisions. *Why: routes stay readable, and every rule is testable without HTTP.*
- **`<area>.service.ts`**: `export const AreaService = { method: async (...) => {...} }`. Orders the work: load through the repository, ask a helper to decide, apply through the repository, then run side effects (calls, WhatsApp, events). *Why: one place shows the sequence of a use case.*
- **`<area>.repository.ts`**: `export const AreaRepository = {...}`. Holds every SQL statement for its tables and is the only kind of file that imports `q`/`one` from `lib/core/db`. Returns typed rows. The only logic allowed is the compare-and-set guard in a `where`. *Why: queries are found, reviewed and changed in one place.*
- **`<area>.helper.ts`**: pure functions. No I/O and no `now()`: time comes in as a `now: Date` parameter. All branching rules (which hospital to redial, when a wave times out, what a status change means) live here and have unit tests. *Why: the rules that matter in an emergency are tested directly.*
- **`<area>.type.ts`** for types and **`<area>.validation.ts`** for zod schemas.
- **The "decide" pattern:** for multi-step logic (e.g. `evaluateReferral`) the service loads a snapshot, a helper returns a plan (a list of steps), and the service applies the steps in order. *Why: the plan is a pure function of the snapshot, so every branch can be tested without a database.*

### Correctness
- Concurrency stays as it is: compare-and-set updates (`where status = $old`), the atomic wave claim, and unique indexes (migration 0002) instead of transactions. *Why: it already works on PGlite and the Supabase pooler, and the tests cover it. Revisit only with a failing test.*
- All timestamps come from `lib/core/clock.ts` (`now()`); helpers receive `now` explicitly.
- Statuses, outcomes and purposes use the union types (`AttemptStatus`, `Outcome`, `Purpose`, …), never `string`. *(improves Divit)*
- No `as` casts on jsonb or provider payloads: read them with zod or a small typed reader that returns `null` when a value is missing. *(improves Divit)*

### Errors and logging
- Throw `ApiError` (`lib/core/error.ts`) through static constructors that keep today's stable codes: `ApiError.notFound(msg)`, `ApiError.conflict(code, msg)`, `ApiError.unprocessable(code, msg, details)`, `ApiError.unauthorized(msg)`, `ApiError.forbidden(msg)`, `ApiError.tooMany(code, msg)`. Anything else becomes `500 INTERNAL` in `handle()`. *Why: the console and the tests rely on the codes.*
- Log through `createLogger("<area>")` (`lib/core/logger.ts`) with structured fields, never `console.*`. Never log phone numbers, names, notes, transcripts or message bodies; pass provider error text through `redactNumbers`. *Why: CLAUDE.md rule 1.*
- External calls (Bolna, Meta, Twilio, Sarvam) have a timeout, give the user one clear error, put the cause only in the log, and never retry where a retry could dial or message someone twice.

### Comments
- Every exported function gets a one-sentence JSDoc stating its contract in plain words ("Null when…", "Idempotent.").
- Why-comments cite the rule's source (`docs/02-architecture.md §6.3`, a Bolna gotcha, a CLAUDE.md rule). No comments that narrate the code.
- Short sentences, one idea each. *(improves Divit: some of his comments pack three clauses into one.)*

### Formatting
- Import and export lists stay on one line, however long (the user's rule from MARCOFED, 2026-10-08).
- Object literals and argument lists longer than about 140 characters go multi-line, one property per line. *(improves Divit: his 250-character object lines.)*
- Keep the repo's existing style (double quotes, semicolons). Don't reformat lines you don't change.

### Tests
- Every helper has unit tests; services are covered by integration tests on PGlite (`tests/helpers.ts`).
- Tests check that identifiers never reach logs, events or browser responses.
- A bug fix comes with a test that failed before it.

### Components
- One component per file, in feature folders (`components/board/`, `components/referral-form/`, …), each file under about 250 lines.
- Data shaping for the UI lives in client-safe pure functions (`lib/ui/`), not inside components.
- Server modules start with `import "server-only"`; client components import only client-safe modules.

## 3. Target layout

```
lib/core/            config, clock, db, error, logger, route (parseBody, handle, functionRoute), normalize, types
lib/integrations/    bolna/ (client, auth, agents) · whatsapp/ (send, inbound parse + signatures) · sarvam/ (speech to text)
lib/modules/
  referral/          create, preview, select, confirm, cancel, close, widen, evaluate (planner in referral.helper.ts), browser view
  call/              call attempts: dispatch, redial, release, hold, family call, Bolna webhook + function handlers, missed-webhook recovery
  facility/          directory (facilities, contacts, capabilities) and matching
  handoff/           WhatsApp message texts and sending
  intake/            WhatsApp intake drafts, parsing, voice notes
  auth/              session, gate, password, throttle, org scope, safe redirects
  demo/              demo console, simulator, run sheet, judge cards, test matrix
  maintenance/       cron tick, retention purge
  analytics/ portal/
lib/ui/              client-safe display helpers (tones, labels, timeline text)
components/<area>/   one component per file
```

## 4. Plan

Run `bun run lint && bun run typecheck && bun run test` after every phase (not `bun test`: the tests use vitest); all must pass. One commit per phase; the user approved this on 2026-10-31 ("start this"). Stage explicit paths, never `git add -A`. Don't push unless asked.

| # | Phase | Status |
|---|---|---|
| 0 | Commit the concurrent security session's work and this session's UI and performance fixes as the baseline | done: b886df9 |
| 1 | `lib/core/`: `ApiError`, logger, route helpers; move config, clock, db, normalize, types. Mechanical; update imports | done: 3ec3f4e (118 tests) |
| 2 | Split `orchestrator.ts`, `handlers.ts`, `repo.ts`, `events.ts` into `referral/` and `call/`; evaluate becomes planner (helper) + applier (service), with unit tests for every branch | done: 671dc67 (135 tests); bug fix 1afb484 |
| 3 | Move the remaining `lib/*.ts` into modules and integrations; only `*.repository.ts` touches the database; request schemas per module | done: 7d3e0de (move), f69b46b (repositories, schemas) |
| 4 | Split `LiveBoard.tsx`, `ReferralForm.tsx`, `FacilitiesAdmin.tsx`, `DemoPanel.tsx` into feature folders (`components/board`, `referral-form`, `facilities`, `demo`); remaining loose components into `shell`, `auth`, `analytics` | done |
| 6 | Leftovers from the audit: zod instead of casts (session claims, demo scenario), JSDoc on every export, shared status unions, line lengths, `AuthService`, `MissedCallService`, `readInbound`, `EvaluationService` split out of `ReferralService` | done |
| 5 | Update the "Where things are" table in `CLAUDE.md` and the layout in `README.md` | done (with docs/02, docs/04, docs/whatsapp-templates paths) |

## 5. Decisions

- 2026-11-01: left as plain `string` on purpose: Bolna's raw status (`bolna.client.ts`, the webhook log), because it is provider text; it is mapped to `AttemptStatus` at the edge by `mapBolnaStatus`.
- 2026-11-01: long lines kept: Kannada and Hindi message templates, prompt text, regexes, scripted data rows and import lists. Wrapping them risks changing text people hear or read.
- 2026-11-01: `ReferralService` is still about 400 lines (create, select, hold, confirm, cancel, close, widen). Split further only when a change needs it.

- 2026-10-31: working with a second session (haazir-58) on the same checkout. Split agreed by message: haazir-be owns lib/**, app/api/**, tests/**, CLAUDE.md, README.md and import lines; haazir-58 owns what it is handed (prompts, docs/05, now the UI). Neither commits the other's files; haazir-be makes all commits, one per piece of work.
- 2026-10-31: `scripts/` keep using `lib/core/db` directly (connect, migrate): they are infrastructure, not app code.
- 2026-10-31: `docs/07-build-plan.md` keeps its original file names: it is the historical ticket list.

- 2026-10-31: `ReferralService` and `CallService` import each other (evaluation dispatches calls; a manual outcome re-evaluates). Allowed: they only reach each other inside function bodies, never at module load.
- 2026-10-31: bug found by the new planner tests: an extracted yes with bed `none` was recorded as accepted, because `clean()` treats "none" as missing. Fixed in its own commit (1afb484), so the refactor commits stay behaviour-preserving.

- 2026-10-30: no transactions; keep compare-and-set and unique guards (see Correctness).
- 2026-10-30: keep double quotes and the current formatting; adopt Divit's structure, not his quote style.

## 6. Changelog

- 2026-11-01: audit leftovers done (phase 6). Routes are thin (login, WhatsApp inbound, missed call), `EvaluationService` is split out, loose components are in feature folders. Items kept on purpose are listed under Decisions.

- 2026-10-31: phase 4 done: board, referral-form, facilities and demo split into feature folders; client-safe helpers in `lib/ui/board.ts`, `request-id.ts`, `demo.ts`; 147 tests. All phases done.
- 2026-10-31: phase 3 and 5 done; 139 tests. Phase 4 waits for haazir-58's UI handover.
- 2026-10-31: phase 2 done (671dc67) + bed-none fix (1afb484). Another session is editing `components/LiveBoard.tsx`, `README.md`, `vercel.json` (speed work); phase 3 waits because moving `lib/view.ts` and `lib/ui.ts` rewrites LiveBoard imports.
- 2026-10-31: user said start; the concurrent session had also moved the repo to Bun (`bun.lock`, `bun run serve`, `instrumentation.ts`).
- 2026-10-30: created; rules from a review of Divit's MARCOFED code; refactor blocked on a concurrent session (phase 0).
