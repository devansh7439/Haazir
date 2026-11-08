import { api } from './client';
import { BootstrapSchema, ConfigSchema, LoginSchema } from './schema';

/** A shared passcode, or an email and password. */
export type Credentials = { passcode: string } | { email: string; password: string };

export const SessionRepository = {
  /** How people sign in on this server. Needs no session. */
  authMode: async (baseUrl: string) => (await api('/api/mobile/config', ConfigSchema, { baseUrl })).auth_mode,

  /** Signs in and returns the session token (null for a passcode server that uses a cookie only). */
  login: async (baseUrl: string, credentials: Credentials) =>
    (await api('/api/login', LoginSchema, { baseUrl, body: credentials, mobileLogin: true })).token,

  /** Who is signed in and what the forms need. */
  bootstrap: () => api('/api/mobile/bootstrap', BootstrapSchema),
};
