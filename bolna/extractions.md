# Bolna extractions (post-call second opinion)

Extractions run on the transcript after the call and arrive in the `completed` webhook as
`extracted_data → <category> → <extraction name> → { subjective, objective, confidence, confidence_label, … }` **[B13]**.
We use them to **cross-check** the mid-call function result (`02-architecture.md` §5.4) and as a **fallback** when the function wasn't called.

Set them up in the agent's **Extractions** tab. The category model defaults to `gpt-4.1-mini`.

---

## Availability agent → category `Referral outcome`

| Extraction name | Answer type | Options (value → condition) or format |
|---|---|---|
| `availability_outcome` | Pre-defined | `accepted` → the hospital clearly agreed to accept the patient now, without conditions · `conditional` → agreed, but only with a condition · `declined` → said they cannot accept · `redirected` → asked us to call a different number or department · `needs_doctor` → asked to speak with the referring doctor before deciding · `callback_later` → asked to be called back later · `ivr_or_recording` → no human answered: phone menu, recorded message or voicemail · `unclear` → none of the above is clear from the conversation |
| `bed_type` | Pre-defined | `icu_with_ventilator` · `icu` · `hdu` · `nicu` · `emergency_only` · `ward` · `none` · `unknown` |
| `ready_in_minutes` | Free text, format **Numeric** | Minutes until they are ready, if stated |
| `contact_person` | Free text | Name or role to ask for, if stated |
| `conditions` | Free text | Any condition on acceptance |
| `decline_reason` | Pre-defined | `no_bed` · `no_ventilator` · `no_specialist` · `full` · `not_our_case` · `other` · `not_applicable` |

**Extraction prompt for `availability_outcome`** (paste into the template):
```text
You are reading a phone call between an automated referral assistant and a hospital emergency desk. Decide what the hospital answered about accepting the patient. Choose "accepted" only if a hospital staff member clearly said they can take the patient now. If the staff member changed their answer during the call, use their final answer. If no human spoke, choose "ivr_or_recording".
```

**Reading it in code**
```ts
const ro = execution.extracted_data?.["Referral outcome"];
const extractionOutcome = ro?.availability_outcome?.objective ?? null;          // e.g. "accepted"
const confident = ["High", "Medium"].includes(ro?.availability_outcome?.confidence_label);
```
Look up category and extraction names case-insensitively, since a renamed category in the dashboard silently breaks exact-match lookups.

---

## Hold-confirm agent → category `Hold`

| Extraction name | Answer type | Options |
|---|---|---|
| `hold_confirmed` | Pre-defined | `yes` → they agreed to keep the bed ready · `no` → they said they can no longer take the patient · `unclear` |
| `contact_person` | Free text | Name or role to ask for |

## Release and family agents
No extractions needed. A `completed` status is enough.

---

## Test them
Use the dashboard's extraction testing on 3 real test-call transcripts (accepted, declined, unclear) before the demo. See Bolna's *Testing extractions* page.
