import "server-only";
import { env } from "@/lib/core/config";
import { createLogger } from "@/lib/core/logger";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { PushRepository } from "@/lib/modules/push/push.repository";
import type { PushKind } from "@/lib/modules/push/push.type";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { spokenName } from "@/lib/modules/referral/summary.helper";

// Written without an Expo account to test against: the request and response shapes follow Expo's push API
// (POST https://exp.host/--/api/v2/push/send). Try it on a real device before relying on it.

const log = createLogger("push");
const TIMEOUT_MS = 5000;

/** Sends still in flight. Notifications never delay the call that caused them; tests wait on this. */
const pending = new Set<Promise<void>>();

interface Message {
  title: string;
  body: string;
}

/** The text of each notification. Referral code and hospital name only: never a patient or family detail (CLAUDE.md rule 1). */
const textFor = (kind: PushKind, code: string, hospital: string | null): Message => {
  const who = hospital ?? "A hospital";
  switch (kind) {
    case "first_yes": return { title: `First yes · ${code}`, body: `${who} can take the patient. Open Haazir to choose.` };
    case "doctor_wanted": return { title: `A desk wants you · ${code}`, body: `${who} wants to talk to you. Call them back.` };
    case "hospital_called_back": return { title: `A hospital called back · ${code}`, body: `${who} called the line. Open Haazir.` };
    case "bed_held": return { title: `Bed held · ${code}`, body: `${who} confirmed the bed.` };
    case "bed_declined": return { title: `Bed no longer available · ${code}`, body: `${who} can't take the patient now. Choose another hospital.` };
    case "exhausted": return { title: `No hospital accepted · ${code}`, body: "Open Haazir to call the desks or widen the search." };
  }
};

interface Ticket {
  status: "ok" | "error";
  details?: { error?: string };
}

const send = async (tokens: string[], message: Message, referralId: string): Promise<void> => {
  const res = await fetch(env.expoPushUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
    },
    body: JSON.stringify(
      tokens.map((to) => ({ to, title: message.title, body: message.body, sound: "default", priority: "high", channelId: "referrals", data: { referralId } })),
    ),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Expo push answered ${res.status}`);
  const body = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
  // A device that uninstalled the app is reported once; stop sending to it.
  const dead = (body?.data ?? []).flatMap((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? [tokens[i]] : []));
  await PushRepository.removeAny(dead);
  if (dead.length > 0) log.info({ removed: dead.length }, "removed tokens Expo no longer accepts");
};

/** Push notifications to the doctor's phone (the mobile app). Best effort: a failure is logged and nothing else. */
export const PushService = {
  /** Saves this device's token for the signed-in person. */
  register: (orgId: string, userId: string | null, token: string, platform: string): Promise<void> => PushRepository.upsert(orgId, userId, token, platform),

  /** Forgets this device's token (sign out). */
  unregister: (orgId: string, token: string): Promise<boolean> => PushRepository.remove(orgId, token),

  /**
   * Tells the doctor's devices about a referral. Returns at once: the send runs in the background, never retries (a
   * retry could notify twice) and never throws. `facilityId` names the hospital in the text.
   */
  notify: async (referralId: string, kind: PushKind, facilityId: string | null = null): Promise<void> => {
    try {
      const r = await ReferralRepository.get(referralId);
      if (!r) return;
      const tokens = (await PushRepository.forReferral(r.org_id, r.referrer_id)).map((t) => t.token);
      if (tokens.length === 0) return;
      const facility = facilityId ? await FacilityRepository.get(facilityId) : null;
      const message = textFor(kind, r.code, facility ? spokenName(facility.name) : null);
      const job = send(tokens, message, r.id)
        .catch((err) => log.warn({ kind, err }, "push notification failed"))
        .finally(() => pending.delete(job));
      pending.add(job);
    } catch (err) {
      log.warn({ kind, err }, "push notification skipped");
    }
  },

  /** Waits for notifications still being sent. For tests and a clean shutdown. */
  flush: async (): Promise<void> => {
    await Promise.all([...pending]);
  },
};
