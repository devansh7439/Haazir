import { z } from "zod";
import { PUSH_PLATFORMS } from "@/lib/modules/push/push.type";

/** Expo's push token format, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. */
const token = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/, "Not an Expo push token");

/** POST /api/mobile/push: this device's token and platform. */
export const PushRegisterBody = z.object({ token, platform: z.enum(PUSH_PLATFORMS) });
/** DELETE /api/mobile/push: forget this device's token. */
export const PushUnregisterBody = z.object({ token });
