# Haazir

**Emergency referral router for Indian hospitals** (Bolna Symphony Buildathon 2026).
When a small hospital can't treat a critically ill patient, Haazir phones every capable hospital nearby **at the same time, in their language**, and hands the doctor a **confirmed bed with a recorded, timestamped answer**.

> Dashboards show what a hospital typed yesterday. Haazir asks them now.

The product thinking, architecture and contracts are in [`docs/`](docs/README.md). Start with `docs/01-product-blueprint.md` and `docs/07-build-plan.md`.

## What works today

| Area | Status |
|---|---|
| New referral form: case templates, needs chips, identifier guard, live "what hospitals will hear" preview, ranked hospitals with reasons | ✅ |
| Matching (capability + radius + ETA + track record, IVR lines last) | ✅ |
| Wave of 6 parallel Bolna calls, atomic wave claim, wave 2 and *exhausted* with a tap-to-call list, widen to 80 km | ✅ |
| Bolna webhook (monotonic statuses) and the five mid-call function routes (always 200 + `instruction`) | ✅ |
| Live board: map pins, cards grouped Accepted / In progress / Waiting / Not available, timer, TTFA, timeline, aria-live | ✅ |
| Select → hold-confirm call → WhatsApp handoff (hospital, doctor, family in en/kn/hi) → release calls; manual confirm; cancel; close; hold expiry | ✅ |
| Needs-doctor banner with `tel:`, callbacks ("call me back in N min"), busy redial, redirect to a new number, manual outcome, manual redial | ✅ |
| Post-call extraction cross-check → *needs review* (select blocked unless forced) | ✅ |
| Simulation mode through the same handlers (`scenarios/demo-krait-bite.json`), SIMULATED badge | ✅ |
| Facilities admin, Demo control panel (assign phones, test calls, reset, last webhook), History with median real TTFA | ✅ |
| Passcode gate for the console; secrets on Bolna routes | ✅ |
| Real WhatsApp via Meta or Twilio | Adapter written, untested against live providers |
| Live Bolna calls | Contract-tested with a stubbed Bolna; **needs a day-1 test call** (see below) |

## Run it locally (no accounts needed)

```bash
npm install
cp .env.example .env.local      # DATABASE_URL=pglite:./.data/pglite works as-is
npm run dev
```

Open http://localhost:3000, pick **Snakebite – neurotoxic signs**, set **Critical**, tick **Run as simulation**, and press **Find a bed**. Or use **Demo → Run simulated referral**. The embedded database creates its schema and seed on first start.

## Tests

```bash
npm run lint && npm run typecheck && npm test
```

37 tests, including the ones `CLAUDE.md` asks for: the exact krait-bite spoken summary, the 10-digit note guard, monotonic statuses under replayed/out-of-order webhooks, the `%(x)s`/`None` normaliser, matching order on the seed (Tamarind 18 → Lotus 74 min), no identifiers in availability `user_data`, and an end-to-end simulated referral that reaches `confirmed` with exactly two release calls (Banyan, Mango Grove). Integration tests run on an in-memory Postgres (PGlite) with the real migrations.

## Deploy (Supabase + Vercel + Bolna)

1. **Supabase**: create a project. Apply the schema with `DATABASE_URL=<connection string> npm run db:setup`, or paste `supabase/migrations/*.sql` then `supabase/seed.sql` into the SQL editor.
2. **Vercel**: import the repo and set the env vars from `.env.example`:
   - `DATABASE_URL`: the Supabase **transaction pooler** URI (port 6543).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser Realtime (cards update within ~1 s instead of on the 5 s tick).
   - `DEMO_PASSCODE`, `APP_BASE_URL`, `BOLNA_*`, `WHATSAPP_PROVIDER`.
3. **Bolna**: build the agents from `bolna/prompts/*.md` and `docs/05-voice-agents.md`. Paste `bolna/tools/*.json` with `YOUR_APP_URL` and `YOUR_BOLNA_FUNCTION_SECRET` replaced. Set each agent's webhook to `https://<app>/api/bolna/webhook?token=<BOLNA_WEBHOOK_SECRET>`.
4. **Demo page**: put in the phones you control, then **Test call** each one.

### Day-1 checks against real Bolna
- A test call's function route receives a real UUID in `attempt_id`, not empty or `%(attempt_id)s`. If it doesn't, the route falls back to matching on `to_number`.
- Check the shape of the `completed` webhook body against `lib/handlers.ts` (`id`, `status`, `transcript`, `telephony_data.recording_url`, `extracted_data`, `context_details`).
- Account concurrency is at least 10.

## Layout

```
app/                 pages (/, /referrals/[id], /facilities, /demo, /history) and API routes
components/          ReferralForm, LiveBoard, BoardMap, FacilitiesAdmin, DemoPanel
lib/                 orchestrator, handlers, simulator, matching, summary, statusMap, normalize, bolna, whatsapp, db, view
supabase/            migrations and seed
bolna/               agent prompts, tool JSON, extraction setup
scenarios/           demo-krait-bite.json
docs/                the build pack
tests/               unit + integration tests
```
