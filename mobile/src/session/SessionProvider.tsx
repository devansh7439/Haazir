import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, api, configureApi } from "../api/client";
import { BootstrapSchema, ConfigSchema, LoginSchema, type Bootstrap } from "../api/schema";
import { normalizeServerUrl } from "../lib/url";
import { storage } from "./storage";

const SESSION_KEY = "haazir.session";
const SERVER_KEY = "haazir.server";

export type Credentials = { passcode: string } | { email: string; password: string };

type State =
  | { status: "loading" }
  | { status: "signedOut"; serverUrl: string }
  | { status: "unreachable"; message: string }
  | { status: "signedIn"; serverUrl: string; boot: Bootstrap };

interface SessionApi {
  state: State;
  /** Asks the server how people sign in, before anyone is signed in. */
  authMode: (serverUrl: string) => Promise<"passcode" | "users">;
  signIn: (serverUrl: string, credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  /** Reloads the case templates and the referrer. */
  reload: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<SessionApi | null>(null);

/** The signed-in person, the server they use and the data the forms need. Restores itself from secure storage. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const serverRef = useRef("");

  const signOut = useCallback(async () => {
    configureApi(null);
    await storage.remove(SESSION_KEY);
    setState({ status: "signedOut", serverUrl: serverRef.current });
  }, []);

  const open = useCallback(
    async (serverUrl: string, token: string | null) => {
      configureApi({ baseUrl: serverUrl, token, onUnauthorized: () => void signOut() });
      return api("/api/mobile/bootstrap", BootstrapSchema);
    },
    [signOut],
  );

  const restore = useCallback(async () => {
    setState({ status: "loading" });
    serverRef.current = (await storage.get(SERVER_KEY)) ?? process.env.EXPO_PUBLIC_API_URL ?? "";
    const saved = await storage.get(SESSION_KEY);
    let session: { serverUrl: string; token: string | null } | null = null;
    try {
      session = saved ? (JSON.parse(saved) as { serverUrl: string; token: string | null }) : null;
    } catch {
      session = null;
    }
    if (!session?.serverUrl) return setState({ status: "signedOut", serverUrl: serverRef.current });
    try {
      const boot = await open(session.serverUrl, session.token);
      setState({ status: "signedIn", serverUrl: session.serverUrl, boot });
    } catch (err) {
      // A 401 already signed the person out. Anything else (no network) keeps the session and offers a retry.
      if (!(err instanceof ApiError && err.status === 401)) {
        setState({ status: "unreachable", message: err instanceof Error ? err.message : "Can't reach the server" });
      }
    }
  }, [open]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const value = useMemo<SessionApi>(
    () => ({
      state,
      authMode: async (serverUrl) => {
        const base = normalizeServerUrl(serverUrl);
        if (!base) throw new ApiError(0, "BAD_URL", "That doesn't look like a server address");
        return (await api("/api/mobile/config", ConfigSchema, { baseUrl: base })).auth_mode;
      },
      signIn: async (serverUrl, credentials) => {
        const base = normalizeServerUrl(serverUrl);
        if (!base) throw new ApiError(0, "BAD_URL", "That doesn't look like a server address");
        const { token } = await api("/api/login", LoginSchema, { baseUrl: base, body: credentials, mobileLogin: true });
        let boot: Bootstrap;
        try {
          boot = await open(base, token);
        } catch (err) {
          configureApi(null);
          throw err;
        }
        serverRef.current = base;
        await storage.set(SERVER_KEY, base);
        await storage.set(SESSION_KEY, JSON.stringify({ serverUrl: base, token }));
        setState({ status: "signedIn", serverUrl: base, boot });
      },
      signOut,
      reload: async () => {
        const s = state;
        if (s.status !== "signedIn") return;
        setState({ ...s, boot: await api("/api/mobile/bootstrap", BootstrapSchema) });
      },
      retry: () => void restore(),
    }),
    [state, open, signOut, restore],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

/** The signed-in state; only for screens that sit behind the sign-in gate. */
export function useSignedIn(): Extract<State, { status: "signedIn" }> & Pick<SessionApi, "signOut" | "reload"> {
  const { state, signOut, reload } = useSession();
  if (state.status !== "signedIn") throw new Error("useSignedIn outside the signed-in area");
  return { ...state, signOut, reload };
}
