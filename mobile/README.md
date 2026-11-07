# Haazir mobile

The doctor's phone app for Haazir: start a referral, watch hospitals answer live, pick one, call a desk. Expo (SDK 58) with React Navigation (bottom tabs and a native stack), TypeScript strict. Its folder layout and English and Hindi switch follow the MARCOFED app; the look is warmer than the web console's, closer to RaktKhoj, with colours, radii and shadow taken from raktkhoj.org: a crimson brand (AA-safe steps of #E8394C) on a warm-grey page (#F6F4F2) with white bars, cards and chips and warm hairlines, RaktKhoj's top bar on Home (logo and wordmark, EN / हिं switch, account button), rose-and-crimson picked chips, dashed empty states, a crimson hero on Home with the network's numbers, flat cards on hairlines (shadow only on what floats), hand-drawn illustrations in `src/components/ui/illustrations.ts` (a phone calling three hospitals, a held bed, nobody answering, an empty list; each shows something that really happens, drawn in ink with an offset flat fill), no pulses or rings, Inter for text and Inter Tight for headings. It talks to the same server as the web console and adds no server of its own.

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
bun run lint           # eslint (eslint-config-expo)
bun run export:web     # browser build in dist/ (a preview; the app targets iOS and Android)
```

## How it is laid out

```
src/
  App.tsx            fonts, language, session, navigation container
  theme/             design tokens (colour, type, space, motion); screens never write a raw hex or font size
  components/ui/     Screen, ScreenHeader, Button, Card, TextField, FilterChip, BottomSheet, Banner, StatusPill, TabBar ...
  navigation/        RootNavigator (signed in or not), MainTabs, route types
  features/<area>/   screens/ and components/ for account, auth, board, hospitals, referral, referrals
  lib/               i18n (English and Hindi), session, push, and the copies of the web's display logic
  api/               the typed client and the zod schemas
```

## Languages

The app shows English or Hindi, chosen on the sign-in screen or in Account, and remembered on the phone. Every text goes through `t('English text')` (or `phrase()` for a constant); the Hindi is in `src/lib/i18n/hindi.ts`, keyed by the English. Text missing there shows in English. Text the server sends (case names, service names, hospital names) is shown as sent.

`src/lib/display.ts` and `board.ts` are kept identical to the web's, so they return English; `src/lib/localize.ts` translates their output. `bun run strings > strings.csv` lists every text with its Hindi. `tests/mobile-i18n.test.ts` (root) fails when a text has no Hindi or loses a `{placeholder}`.

## What it does

| Tab / screen | What |
|---|---|
| Sign in | Server address, then passcode or email and password. The token is kept in the Keychain or Keystore (SecureStore). |
| Home (hospital directory) | The first tab. A "Find a bed" button on top, then the directory: search, filter by service, call a desk, directions. Three tabs: Home, Referrals, Account. |
| Find a bed (opened from Home) | Five steps with Back and Next and a numbered progress bar, each in a numbered card as on raktkhoj.org. 1 Patient: age, sex, urgency, "Condition now" (awake, breathing, time since onset, SpO₂, blood pressure, what has been done) and private patient and family details with consent. 2 Case: the case as a vertical list and an optional note. The taps from step 1 are joined into the note hospitals hear (`features/referral/clinical.helper.ts`, kept under 160 characters). 3 Needs. 4 Search: this phone or your centre, and the distance. 5 Review: a "Before you submit" checklist, the nearest capable hospitals ranked by distance and travel time, what they will hear, and send. Referrals doctors sent by WhatsApp appear at the top of step 1; Review pre-fills the form. Haazir still phones every capable hospital at once. One request id per form makes a double tap safe. The live board replaces this screen, so Back goes to Home. |
| Live board (`referral/[id]`) | Timers, a card per hospital grouped by answer, alerts when a desk asks for the doctor, select a hospital (call to confirm, or "I already confirmed by phone"), call desk, redial, route in Maps, record an outcome by hand, the bed-hold panel with the WhatsApp handoff, family call and released hospitals, patient arrived, cancel, widen when nobody accepted, and the activity feed. |
| Referrals | In progress first, then earlier ones. |
| Hospitals | Search, a service filter (a sheet with a live count), Google star ratings when the server has a Places key, desk numbers to call, directions. |
| Account | Who you are, the server, whether calls and notifications are on, sign out. |

The board ticks the server every second while it is open and the app is in the foreground. The server only advances a referral (second wave, callbacks, hold expiry) when something ticks it, so closing the app mid-referral leaves it to the server's cron (`/api/cron/tick`).

## How it talks to the server

- Sign-in sends `x-haazir-client: mobile` to `POST /api/login`; the answer includes the session `token`. Every later call sends `Authorization: Bearer <token>`. The server accepts the same token in a cookie (web) or the header (app); see `lib/modules/auth/session.service.ts` and `middleware.ts`.
- `GET /api/mobile/config` (public) says which sign-in form to show. `GET /api/mobile/bootstrap` gives the case templates, capabilities and the doctor's referrer id.
- Every answer is checked against a zod schema in `src/api/schema.ts`. A mismatch shows as "this version of the app doesn't understand the server" instead of a crash.
- `src/lib/display.ts`, `board.ts` and `facility.ts` are copies of `lib/ui/*` without the Tailwind and map parts, so statuses read the same on both. `tests/mobile-contract.test.ts` (root) runs a real krait-bite referral through the schemas and compares the copies against the web originals, so drift fails the build.

## Privacy

Patient and family fields live only in the form's memory until the referral is sent, and the form is cleared right after. They are never written to the phone's storage. The board shows only what the web board shows (redacted message previews). The app stores two things: the session token and the server address.

## Push notifications

With the app closed, the server tells the doctor's phone about: the first yes, a desk asking for them, a hospital calling back, a bed held or no longer available, and nobody accepting. Tapping one opens that referral. The text holds only the referral code and the hospital name, never a patient or family detail (tested).

- Server: migration `0010_push_tokens.sql`, `POST` and `DELETE /api/mobile/push-token`, and `PushService` (`lib/modules/push/`). It sends through Expo's push API (`EXPO_PUSH_URL`, `EXPO_ACCESS_TOKEN` are optional). The send runs in the background, never retries (a retry could notify twice) and drops tokens Expo reports as dead. It needs a long-lived Node server, as the rest of the project assumes.
- App: on a real phone the app asks for permission after sign-in, gets an Expo push token and registers it; sign-out removes it.
- To turn it on you need an EAS project. In `mobile/`: `npx eas-cli init`, then build a development or release build (`eas build --profile development`). Expo Go does not receive remote pushes on Android, and simulators don't get tokens. Until then the Account screen says what is missing.

## Building

`eas.json` has `development`, `preview` (installable Android APK) and `production` profiles. Run `npx eas-cli init` once to link an EAS project, then `npx eas-cli build --profile preview --platform android`.

## Not verified

Only the web build has been driven (Chromium at phone size, against the real server and a fake Bolna): sign-in, the whole referral flow, drafts, the hospital filter, outcomes, cancel. Not run on a device or emulator: SecureStore, the location prompt, haptics, `tel:` links, the sheets, and above all push notifications (the server half is tested against a fake Expo endpoint; the phone half and Expo's real service are not). There is no map on the board; each card shows its drive time and a Route in Maps link instead. Run it on a phone before relying on it.
