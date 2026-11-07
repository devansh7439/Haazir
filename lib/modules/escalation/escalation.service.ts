import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import { EscalationRepository } from "@/lib/modules/escalation/escalation.repository";
import type { EscalationContact } from "@/lib/modules/escalation/escalation.type";

/** Who to call beyond 108 and 112 when no hospital accepted. An admin keeps the list; it is empty until they do. */
export const EscalationService = {
  list: (orgId: string): Promise<EscalationContact[]> => EscalationRepository.list(orgId),

  add: async (orgId: string, b: { label: string; phone: string; sort_order: number }): Promise<EscalationContact> => {
    const phone = normalizePhone(b.phone);
    if (!phone) throw ApiError.unprocessable("BAD_NUMBER", "Phone is not a valid phone number");
    return EscalationRepository.upsert(orgId, b.label, phone, b.sort_order);
  },

  remove: async (orgId: string, id: string): Promise<void> => {
    if (!z.string().uuid().safeParse(id).success || !(await EscalationRepository.remove(orgId, id))) throw ApiError.notFound("Escalation number not found");
  },
};
