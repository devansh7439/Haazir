import "server-only";
import { now } from "@/lib/core/clock";
import { q } from "@/lib/core/db";
import type { SendResult } from "@/lib/integrations/whatsapp/whatsapp.client";

/** Who a message is for. */
export type Audience = "receiving_facility" | "referrer" | "family" | "availability_ping";

/** Sent messages (`messages`): server-only, since bodies hold identifiers (CLAUDE.md rule 1). Purged with the retention job. */
export const MessageRepository = {
  insert: async (m: { referral_id: string; audience: Audience; to: string | null; body: string; result: SendResult }): Promise<void> => {
    await q(
      `insert into messages (referral_id, channel, audience, to_number, body, provider, provider_message_id, status, error, created_at)
       values ($1, 'whatsapp', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        m.referral_id,
        m.audience,
        m.to ?? "unknown",
        m.body,
        m.result.provider,
        m.result.provider_message_id,
        m.result.status,
        m.result.error,
        now(),
      ],
    );
  },
};
