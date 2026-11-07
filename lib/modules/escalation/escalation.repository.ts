import "server-only";
import { one, q } from "@/lib/core/db";
import type { EscalationContact } from "@/lib/modules/escalation/escalation.type";

const COLUMNS = "id, label, phone_e164, sort_order";

/** The organisation's escalation numbers (`escalation_contacts`). */
export const EscalationRepository = {
  /** The organisation's escalation numbers, in the order the admin set. */
  list: (orgId: string): Promise<EscalationContact[]> =>
    q<EscalationContact>(`select ${COLUMNS} from escalation_contacts where org_id = $1 order by sort_order, created_at`, [orgId]),

  /** Adds a number, or renames and re-orders it when the organisation already lists it. */
  upsert: async (orgId: string, label: string, phone: string, sortOrder: number): Promise<EscalationContact> =>
    (await one<EscalationContact>(
      `insert into escalation_contacts (org_id, label, phone_e164, sort_order) values ($1, $2, $3, $4)
       on conflict (org_id, phone_e164) do update set label = excluded.label, sort_order = excluded.sort_order
       returning ${COLUMNS}`,
      [orgId, label, phone, sortOrder],
    ))!,

  /** Removes a number, but only one of this organisation's. Returns whether one was removed. */
  remove: async (orgId: string, id: string): Promise<boolean> =>
    (await q(`delete from escalation_contacts where org_id = $1 and id = $2 returning id`, [orgId, id])).length > 0,
};
