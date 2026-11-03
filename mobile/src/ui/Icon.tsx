import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { IconKey } from "../lib/display";

type Name = ComponentProps<typeof Feather>["name"];

/** Line icons for the statuses (never emoji). */
const STATUS_ICON: Record<IconKey, Name> = {
  queued: "clock",
  ringing: "phone-call",
  oncall: "phone-incoming",
  check: "check-circle",
  x: "x-circle",
  phone: "phone",
  callback: "rotate-ccw",
  redirect: "corner-up-right",
  ban: "slash",
  help: "help-circle",
  lock: "lock",
};

export function StatusIcon({ icon, size = 14, color }: { icon: IconKey; size?: number; color: string }) {
  return <Feather name={STATUS_ICON[icon]} size={size} color={color} />;
}

export { Feather as Icon };
export type IconName = Name;
