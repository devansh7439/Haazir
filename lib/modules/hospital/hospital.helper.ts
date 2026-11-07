import { createHash, randomBytes } from "node:crypto";
import type { DeskCallRow, DeskState } from "@/lib/modules/hospital/hospital.type";

/** A link's secret: 256 random bits, as URL-safe text. Only its hash is stored. */
export const newDeskToken = (): string => randomBytes(32).toString("base64url");

/** The SHA-256 hash of a desk token, which is all that is stored. */
export const hashDeskToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Whether a string could be a desk token at all, so junk is turned away before any lookup. */
export const looksLikeDeskToken = (token: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(token);

const LIVE = ["queued", "dialing", "ringing", "in_progress", "wrapping_up"];

/** Where a referral stands for this hospital, from its call and the referral's state. */
export const deskState = (row: DeskCallRow, facilityId: string): DeskState => {
  const yes = row.outcome === "accepted" || row.outcome === "conditional";
  if (yes) {
    if (row.selected_facility_id === facilityId) {
      if (row.referral_status === "confirmed") return "held";
      if (row.referral_status === "confirming") return "chosen";
    }
    if (row.selected_facility_id && row.selected_facility_id !== facilityId) return "released";
    if (["cancelled", "closed", "exhausted"].includes(row.referral_status)) return "released";
    return "said_yes";
  }
  if (row.outcome === "declined") return "said_no";
  if (!row.outcome && LIVE.includes(row.status)) return "asking";
  return "other";
};
