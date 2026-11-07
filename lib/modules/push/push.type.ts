/** What a notification is about. The text for each is in PushService; none of it holds patient identifiers. */
export type PushKind = "first_yes" | "doctor_wanted" | "hospital_called_back" | "bed_held" | "bed_declined" | "exhausted" | "not_arrived";

/** The platforms the mobile app registers from. */
export const PUSH_PLATFORMS = ["ios", "android", "web"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export interface PushToken {
  token: string;
  user_id: string | null;
}
