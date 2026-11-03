import { z } from "zod";

/** Expo's push token format, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. */
const token = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/, "Not an Expo push token");

export const PushRegisterBody = z.object({ token, platform: z.enum(["ios", "android", "web"]) });
export const PushUnregisterBody = z.object({ token });
