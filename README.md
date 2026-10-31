# Haazir

**Emergency referral router for Indian hospitals** (Bolna Symphony Buildathon 2026).
When a small hospital can't treat a critically ill patient, Haazir phones every capable hospital nearby **at the same time, in their language**, and hands the doctor a **confirmed bed with a recorded, timestamped answer**.

> Dashboards show what a hospital typed yesterday. Haazir asks them now.

The product thinking, architecture and contracts are in [`docs/`](docs/README.md). Start with `docs/01-product-blueprint.md` and `docs/07-build-plan.md`.

## What works today

| Area | Status |
|---|---|
| New referral form: case templates, needs, identifier guard, live "what hospitals will hear" preview, ranked hospitals with reasons | ✅ |
| Matching (capability + radius + ETA + track record, IVR lines last), optional max ETA by acuity (C8) | ✅ |
| Wave of 6 parallel Bolna calls, atomic wave claim, wave 2, *exhausted* with tap-to-call list, widen to 80 km | ✅ |
| Bolna webhook (monotonic statuses), five mid-call function routes (always 200 + `instruction`), optional source-IP allowlist | ✅ |
| **Missed-webhook recovery**: calls stuck in a status are re-read from Bolna; lost calls are closed after 15 min with an alert | ✅ |
| Live board: map, grouped cards, timer, TTFA, activity feed, realtime (org-scoped) or tick refresh | ✅ |
| Select → hold-confirm call → WhatsApp handoff → release calls; manual confirm; cancel; close; hold expiry | ✅ |
| Needs-doctor banner, callbacks, busy redial, redirects, manual outcome and redial, extraction cross-check → *needs review* | ✅ |
| **Background cron** (`/api/cron/tick`): next waves, callbacks, hold expiry and recovery with no console open | ✅ |
| **Sign-in**: shared passcode, or per-user email/password with organisations; every route and page scoped to the caller's org | ✅ |
| **Retention**: patient details, message bodies, drafts and raw webhook logs deleted N days after a referral ends | ✅ |
| WhatsApp: Meta templates or plain text, Twilio; inbound webhook with signature checks | ✅ (needs a live provider test) |
| `bun run bolna:agents`: builds the five agents from `bolna/` (dry run by default) | ✅ (verify payload shape before `--apply`) |
| C1 family voice call · C2 WhatsApp text/voice-note intake · C3 missed-call callback · C4 portal-vs-desk flags · C5 analytics · C6 WhatsApp quick reply · C7 Aapat Setu link · C8 max ETA | ✅ |
| Simulation through the same handlers, SIMULATED badge, Demo console | ✅ |
| Demo tools: presenter **run sheet** (script, fallback ladder, 20 hard questions from `docs/08`, measured numbers filled in), printable **judge cards** with assigned phones, **voice test-matrix** tracker (20 scenarios × 2 passes, demo-ready gate) | ✅ |
| Hardening: sign-in throttling, fail-closed production gate, safe post-login redirect, JSON-only console bodies, one referral per "Find a bed" press, live-referral cap per org, doctors refer as themselves | ✅ |

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

95 tests, including the ones `CLAUDE.md` asks for: the exact krait-bite spoken summary, the 10-digit note guard, monotonic statuses under replayed/out-of-order webhooks, the `%(x)s`/`None` normaliser, matching order on the seed (Tamarind 18 → Lotus 74 min), no identifiers in availability `user_data`, and an end-to-end simulated referral that reaches `confirmed` with exactly two release calls (Banyan, Mango Grove). Integration tests run on an in-memory Postgres (PGlite) with the real migrations. Route tests call the actual route handlers: Bolna auth and the always-200 contract, the IP allowlist, cron auth, passcode and user sign-in, organisation isolation, missed calls, signed WhatsApp webhooks, missed-webhook recovery, portal flags and the retention purge.

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
- Check the shape of the `completed` webhook body against `lib/handlers.ts` (`id`, `status`, `transcript`, `telephony_data.recording_url`, `extracted_data`, `context_details`).
- Account concurrency is at least 10.

## Layout

```
app/                 pages (/, /referrals/[id], /facilities, /demo, /history) and API routes
components/          ReferralForm, LiveBoard, BoardMap, FacilitiesAdmin, DemoPanel
lib/                 orchestrator, handlers, simulator, matching, summary, statusMap, normalize, bolna, whatsapp, db, view,
                     session/scope (auth + org isolation), maintenance (cron, purge), portal, intake, analytics, bolnaAgents
scripts/             db-setup, create-user, bolna-agents
supabase/            migrations and seed
bolna/               agent prompts, tool JSON, extraction setup
scenarios/           demo-krait-bite.json
docs/                the build pack
tests/               unit + integration tests
```
