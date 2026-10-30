# WhatsApp message templates (Meta Cloud API)

Meta only delivers messages that **your business starts** (pre-arrival note, doctor confirmation, family update,
bed request) as **approved templates**. Plain text only works inside a 24-hour window after the recipient messaged you.
Twilio's sandbox works with plain text once each recipient has sent the join code.

Create these in WhatsApp Manager → Message templates (category **Utility**), wait for approval, then set the names:

| Env var | Template (suggested name) | Languages |
|---|---|---|
| `META_WA_TEMPLATE_PREARRIVAL` | `haazir_prearrival` | `en` |
| `META_WA_TEMPLATE_DOCTOR` | `haazir_confirmed` | `en` |
| `META_WA_TEMPLATE_FAMILY` | `haazir_family` | `en`, `kn`, `hi` (one template, three translations) |
| `META_WA_TEMPLATE_BED_REQUEST` | `haazir_bed_request` | `en` (only if `WHATSAPP_AVAILABILITY_PING=on`) |

Leave a variable empty to send plain text for that message. Parameters are filled in the order below (`lib/messages.ts`);
an empty value is sent as `—` because Meta rejects empty parameters.

## `haazir_prearrival` (9 parameters)
```
Haazir · Incoming referral {{1}}
From: {{2}}
Patient: {{3}}
Note: {{4}}
Needs: {{5}}
ETA: {{6}}
Confirmed by: {{7}}
Questions: call {{8}}
Aapat Setu: {{9}}
```
1 referral code · 2 doctor, facility and phone · 3 patient name (only in this message) and description · 4 clinical note ·
5 needs · 6 ETA and transport · 7 who confirmed and when · 8 doctor's phone · 9 Aapat Setu link (or —)

## `haazir_confirmed` (8 parameters)
```
Haazir · {{1}} confirmed
{{2}} · about {{3}} min · {{4}}
Ask for: {{5}} · Desk: {{6}}
Conditions: {{7}}
Bed held until {{8}}
```

## `haazir_family` (6 parameters; translate the fixed text, keep the parameter order)
```
Haazir referral {{1}}: Dr. {{2}} has arranged treatment for the patient at {{3}}. Address: {{4}}. Map: {{5}}. Show this message at the casualty desk and ask for {{6}}.
```
The Kannada and Hindi bodies are in `docs/04-api-spec.md` §4.3. Have a native speaker check them before submitting.

## `haazir_bed_request` (5 parameters)
```
Haazir · Bed request {{1}} from {{2}}
{{3}}
Can you accept this patient now? Reply YES {{4}} or NO {{5}}. Add any condition after YES.
```

## Inbound messages
Point the WhatsApp webhook at `https://<app>/api/whatsapp/inbound`.
- **Meta:** set `META_WA_VERIFY_TOKEN` (used for the GET verification) and `META_APP_SECRET` (checks `X-Hub-Signature-256`).
- **Twilio:** set the sandbox "When a message comes in" URL. `TWILIO_AUTH_TOKEN` checks `X-Twilio-Signature`;
  `APP_BASE_URL` must be the exact public URL Twilio calls.
