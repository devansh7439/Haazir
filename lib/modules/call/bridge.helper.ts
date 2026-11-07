// Telephony XML for the bridge number (docs/05-voice-agents.md §7). Plivo's XML: Response, Dial, Number, Speak, Hangup.
// Unverified against a live Plivo account.

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Rings the doctor, for about 30 seconds. */
export const dialXml = (doctorPhone: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="30"><Number>${escapeXml(doctorPhone)}</Number></Dial></Response>`;

/** What the caller hears when no live referral matches: nobody is dialled. */
export const declineXml = (): string =>
  '<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Sorry, we could not connect you. The referring doctor will call you back.</Speak><Hangup/></Response>';
