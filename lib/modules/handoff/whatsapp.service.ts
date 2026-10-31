import "server-only";
import { env } from "@/lib/core/config";
import { isE164, maskPhone } from "@/lib/core/normalize";
import { WhatsAppClient, type SendResult } from "@/lib/integrations/whatsapp/whatsapp.client";
import { EventRepository } from "@/lib/modules/event/event.repository";
import type { Rendered } from "@/lib/modules/handoff/message.helper";
import { MessageRepository, type Audience } from "@/lib/modules/handoff/message.repository";

/** WhatsApp messages about a referral: provider none (stored as simulated, shown in the UI), Meta or Twilio. */
export const WhatsAppService = {
  /**
   * Sends one message, or records it as simulated (simulated referral, no provider, or no valid number). Always
   * stores the full message server-side and a redacted event for the board.
   */
  send: async (opts: {
    referral_id: string;
    audience: Audience;
    to: string | null;
    rendered: Rendered;
    simulated: boolean;
    eventType?: string;
    facilityId?: string | null;
  }): Promise<void> => {
    const to = opts.to && isE164(opts.to) ? opts.to : null;
    const result: SendResult =
      opts.simulated || env.whatsappProvider === "none" || !to
        ? { status: "simulated", provider: "none", provider_message_id: null, error: to ? null : "no WhatsApp number" }
        : await WhatsAppClient.deliver(to, opts.rendered);
    await MessageRepository.insert({ referral_id: opts.referral_id, audience: opts.audience, to, body: opts.rendered.body, result });
    await EventRepository.add(opts.referral_id, opts.eventType ?? "handoff_sent", {
      audience: opts.audience,
      facility_id: opts.facilityId ?? null,
      to_masked: maskPhone(to),
      status: result.status,
      preview_redacted: opts.rendered.preview_redacted,
    });
  },

  /** A direct reply in an open conversation (e.g. "Noted: R-4821 accepted"). Never carries identifiers; not stored. */
  reply: async (to: string, body: string): Promise<void> => {
    if (env.whatsappProvider === "none" || !isE164(to)) return;
    await WhatsAppClient.deliver(to, { body });
  },
};
