/** Runs a console action (POST with a JSON body), then re-reads the board. `ok` is false when the server refused it. */
export type Post = (url: string, body?: unknown) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
