import "server-only";
import { env } from "@/lib/core/config";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import type { Session } from "@/lib/modules/auth/session.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

/** What the mobile app needs to draw its first screen after sign-in. */
export interface MobileBootstrap {
  user: { name: string | null; email: string | null; role: Session["role"] };
  /** The doctor the session refers as; null when the organisation has none yet. */
  referrer: { id: string; name: string; facility: string | null } | null;
  templates: CaseTemplate[];
  capabilities: Capability[];
  /** Whether "Find a bed" can place real calls (Bolna key and availability agent are set). */
  bolna_ready: boolean;
}

/** Data the mobile app loads that the web console loads on the server. */
export const MobileService = {
  /** The sign-in mode, so the app shows the right form before anyone is signed in. */
  config: (): { auth_mode: "passcode" | "users" } => ({ auth_mode: env.authMode }),

  /** The session's user, its referrer and the form's case templates and capabilities. */
  bootstrap: async (s: Session): Promise<MobileBootstrap> => {
    const [templates, capabilities, referrer] = await Promise.all([
      ReferralRepository.caseTemplates(),
      FacilityRepository.allCapabilities(),
      ReferralRepository.defaultReferrer(s.org, s.rid),
    ]);
    return {
      user: { name: s.name, email: s.email, role: s.role },
      referrer,
      templates,
      capabilities,
      bolna_ready: !!env.bolnaApiKey && !!env.agentId("availability"),
    };
  },
};
