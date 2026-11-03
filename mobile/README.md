# Haazir mobile

The doctor's phone app for Haazir: start a referral, watch hospitals answer live, pick one, call a desk. Expo (SDK 58) with Expo Router, TypeScript strict. It talks to the same server as the web console and adds no server of its own.

## Run it

```bash
cd mobile
bun install
bun run start          # then press i / a, or scan the QR code with Expo Go
```

On the sign-in screen enter your server's address (your ngrok or cloudflared URL, or the deployed one). The app asks the server how people sign in (shared passcode or email and password) and shows the matching form. To pre-fill the address, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

Use an `https://` address on a real phone. A plain `http://` LAN address works in Expo Go on iOS but Android blocks cleartext traffic in builds.

Other commands:

```bash
bun run typecheck      # tsc --noEmit
bun run export:web     # browser build in dist/ (a preview; the app targets iOS and Android)
```

## What it does

| Tab / screen | What |
|---|---|
| Sign in | Server address, then passcode or email and password. The token is kept in the Keychain or Keystore (SecureStore). |
| New referral | Case, needs, acuity, age, sex, note, optional patient and family details with consent, search distance, optional "start from my location". A live preview shows exactly what hospitals will hear and who will be phoned. One request id per form makes a double tap safe. |
| Live board (`referral/[id]`) | Timers, a card per hospital grouped by answer, alerts when a desk asks for the doctor, select a hospital (call to confirm, or "I already confirmed by phone"), call desk, redial, record an outcome by hand, the bed-hold panel with the WhatsApp handoff, family call and released hospitals, patient arrived, cancel, widen when nobody accepted, and the activity feed. |
| Referrals | In progress first, then earlier ones. |
| Hospitals | Search, services, desk numbers to call, directions. |
| Account | Who you are, the server, whether calls are on, sign out. |

The board ticks the server every second while it is open and the app is in the foreground. The server only advances a referral (second wave, callbacks, hold expiry) when something ticks it, so closing the app mid-referral leaves it to the server's cron (`/api/cron/tick`).

## How it talks to the server

- Sign-in sends `x-haazir-client: mobile` to `POST /api/login`; the answer includes the session `token`. Every later call sends `Authorization: Bearer <token>`. The server accepts the same token in a cookie (web) or the header (app); see `lib/modules/auth/session.service.ts` and `middleware.ts`.
- `GET /api/mobile/config` (public) says which sign-in form to show. `GET /api/mobile/bootstrap` gives the case templates, capabilities and the doctor's referrer id.
- Every answer is checked against a zod schema in `src/api/schema.ts`. A mismatch shows as "this version of the app doesn't understand the server" instead of a crash.
- `src/lib/display.ts`, `board.ts` and `facility.ts` are copies of `lib/ui/*` without the Tailwind and map parts, so statuses read the same on both. `tests/mobile-contract.test.ts` (root) runs a real krait-bite referral through the schemas and compares the copies against the web originals, so drift fails the build.

## Privacy

Patient and family fields live only in the form's memory until the referral is sent, and the form is cleared right after. They are never written to the phone's storage. The board shows only what the web board shows (redacted message previews). The app stores two things: the session token and the server address.

## Not verified

Only the web build has been driven (Chromium at phone size, against the real server and a fake Bolna). Not yet run on a device or emulator: SecureStore, the location prompt, haptics, `tel:` links and the bottom-sheet modal behave differently on native, and there are no app icons or splash designed for release yet. Run it on a phone before relying on it.
