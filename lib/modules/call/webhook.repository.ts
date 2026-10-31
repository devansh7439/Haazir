import "server-only";
import { now } from "@/lib/core/clock";
import { json, q } from "@/lib/core/db";
import type { BolnaStatus } from "@/lib/integrations/bolna/bolna.client";

/** What a log row is tagged with: a Bolna status, or where the payload came from. */
export type LogTag = BolnaStatus | `function:${string}` | `poll:${string}` | `inbound_${string}`;

/** The raw log of everything Bolna sent (`bolna_webhook_log`), kept for debugging and purged with the retention job. */
export const WebhookLogRepository = {
  /** Stores one payload under its tag. A status Bolna sent that we don't know is stored untagged (null); the payload keeps it. */
  log: async (executionId: string | null, status: LogTag | null, payload: unknown): Promise<void> => {
    await q(
      `insert into bolna_webhook_log (execution_id, status, payload, received_at) values ($1, $2, $3::jsonb, $4)`,
      [executionId, status, json(payload), now()],
    );
  },

  /** When Bolna last sent a status webhook and a function call, for the Demo page. */
  lastContact: async (): Promise<{ last_webhook_at: string | null; last_function_at: string | null }> => {
    const [w] = await q<{ at: Date | null }>(
      `select max(received_at) as at from bolna_webhook_log
       where status is null or (status not like 'function:%' and status not like 'poll:%' and status not like 'inbound_%')`,
    );
    const [f] = await q<{ at: Date | null }>(`select max(received_at) as at from bolna_webhook_log where status like 'function:%'`);
    return {
      last_webhook_at: w?.at ? new Date(w.at).toISOString() : null,
      last_function_at: f?.at ? new Date(f.at).toISOString() : null,
    };
  },
};
