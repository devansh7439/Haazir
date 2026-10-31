# Haazir

**Emergency referral router for Indian hospitals** (Bolna Symphony Buildathon 2026).
When a small hospital can't treat a critically ill patient, Haazir phones every capable hospital nearby **at the same time, in their language**, and hands the doctor a **confirmed bed with a recorded, timestamped answer**.

> Dashboards show what a hospital typed yesterday. Haazir asks them now.

The product thinking, architecture and contracts are in [`docs/`](docs/README.md). Start with `docs/01-product-blueprint.md` and `docs/07-build-plan.md`.

## Safety and ethics

> Haazir only calls hospital emergency lines, always says it is an automated assistant working for a named doctor, and never shares a patient's identity until a hospital has agreed to accept them. It records answers so that referrals are accountable, never makes medical decisions, never takes money for ranking, and leaves the final choice to the doctor. All testing was done with consenting hospitals and doctors, using clearly labelled calls and fictional patients.

The family is messaged or called only when the referring doctor ticked that the attendant agreed (`docs/09-validation-safety-compliance.md` §3).

## Run it locally (no accounts needed)

```bash
bun install
cp .env.example .env.local      # DATABASE_URL=pglite:./.data/pglite works as-is
bun run dev                      # for editing code: compiles each page on first visit (~200–500 ms per page)
bun run serve                    # for demos and rehearsals: production build, ~30–40 ms per page
```

Use `bun run serve` whenever speed matters: dev mode is 6–12× slower. Use `bun run test`, not `bun test` (that is Bun's own runner; the tests use vitest).

Open http://localhost:3000, pick **Snakebite – neurotoxic signs**, set **Critical**, tick **Run as simulation**, and press **Find a bed**. Or use **Demo → Run simulated referral**. The embedded database creates its schema and seed on first start.

## Tests

```bash
bun run lint && bun run typecheck && bun run test
```

193 tests, including the ones `CLAUDE.md` asks for: the exact krait-bite spoken summary, the 10-digit note guard, monotonic statuses under replayed/out-of-order webhooks, the `%(x)s`/`None` normaliser, matching order on the seed (Tamarind 18 → Lotus 74 min), no identifiers in availability `user_data`, and an end-to-end simulated referral that reaches `confirmed` with exactly two release calls (Banyan, Mango Grove). Integration tests run on an in-memory Postgres (PGlite) with the real migrations. Route tests call the actual route handlers: Bolna auth and the always-200 contract, the IP allowlist, cron auth, passcode and user sign-in, organisation isolation, missed calls, signed WhatsApp webhooks, missed-webhook recovery, portal flags and the retention purge. Unit tests cover every branch of the evaluation planner (`tests/planner.test.ts`), so the rules that decide redials, waves and releases are tested without a database.

## Deploy (Supabase + Vercel + Bolna)

1. **Supabase**: create a project in **ap-south-1 (Mumbai)**. `vercel.json` runs the app's functions in Mumbai (`bom1`) too; every request makes several sequential queries, so a database in another region adds ~200 ms per query (a "Find a bed" makes about 40). Apply the schema with `DATABASE_URL=<connection string> bun run db:setup`, or paste `supabase/migrations/*.sql` then `supabase/seed.sql` into the SQL editor.
2. **Vercel**: import the repo and set the env vars from `.env.example`:
   - `DATABASE_URL`: the Supabase **transaction pooler** URI (port 6543).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser Realtime (cards update within ~1 s instead of on the 5 s tick).
   - `DEMO_PASSCODE`, `APP_BASE_URL`, `BOLNA_*`, `WHATSAPP_PROVIDER`.
3. **Bolna**: `bun run bolna:agents` writes each agent's payload to `bolna/generated/` for review; compare one with Bolna's API reference, then `bun run bolna:agents -- --apply`. Or build them by hand from `bolna/prompts/*.md` and `docs/05-voice-agents.md`. Paste `bolna/tools/*.json` with `YOUR_APP_URL` and `YOUR_BOLNA_FUNCTION_SECRET` replaced. Set each agent's webhook to `https://<app>/api/bolna/webhook?token=<BOLNA_WEBHOOK_SECRET>`.
4. **Demo page**: put in the phones you control, then **Test call** each one.

### Production checklist
- `AUTH_MODE=users` with a `SESSION_SECRET`, then create people with
  `DATABASE_URL=… bun run user:create -- --email … --name … --password … --org "Your network" --role admin`.
- `SUPABASE_JWT_SECRET` so Realtime only delivers your organisation's rows (migration 0003 removes anonymous reads).
- `CRON_SECRET` and `supabase/cron.sql` (or a Vercel cron on a paid plan) so waves, callbacks and recovery run with no console open.
- Optional: `BOLNA_IP_ALLOWLIST=on`, Meta templates (`docs/whatsapp-templates.md`), `RETENTION_DAYS`.
- Existing databases: `bun run db:setup` applies only the migrations not yet recorded.

### Day-1 checks against real Bolna
- A test call's function route receives a real UUID in `attempt_id`, not empty or `%(attempt_id)s`. If it doesn't, the route falls back to matching on `to_number`.
- Check the shape of the `completed` webhook body against `lib/modules/call/webhook.helper.ts` (`id`, `status`, `transcript`, `telephony_data.recording_url`, `extracted_data`, `context_details`).
- Account concurrency is at least 10.

## Layout

```
app/                 pages (/, /referrals/[id], /facilities, /demo, /history) and API routes
components/          board/, referral-form/, facilities/, demo/ (one component per file)
lib/core/            config, clock, db, ApiError, logger, route helpers, normalisers, row types
lib/integrations/    bolna (client, auth, agent builder), whatsapp (send, inbound), sarvam, supabase browser client
lib/modules/         referral, call, facility, handoff, intake, portal, analytics, maintenance, demo, auth, event, setting:
                     each split into repository (SQL), service (steps), helper (pure rules), type and validation files
lib/ui/              client-safe display helpers
context.md           code-quality rules and the refactor plan
scripts/             db-setup, create-user, bolna-agents
supabase/            migrations and seed
bolna/               agent prompts, tool JSON, extraction setup
scenarios/           demo-krait-bite.json
docs/                the build pack
tests/               unit + integration tests
```
