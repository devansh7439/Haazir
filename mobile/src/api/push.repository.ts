import { z } from 'zod';
import { api } from './client';

const RegisteredSchema = z.object({ ok: z.literal(true) });
const RemovedSchema = z.object({ removed: z.boolean() });

export const PushRepository = {
  /** Tells the server to send this phone's notifications to the Expo push token. */
  register: (token: string, platform: 'ios' | 'android') => api('/api/mobile/push-token', RegisteredSchema, { body: { token, platform } }),

  /** Stops notifications to this phone. */
  unregister: (token: string) => api('/api/mobile/push-token', RemovedSchema, { method: 'DELETE', body: { token } }),
};
