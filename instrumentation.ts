// Runs once when the server starts, before the first request.
// Opening the database here moves its start-up cost off the first user's request: the embedded PGlite
// database takes about 3 s to load and check migrations; a Postgres pool opens its first connection.
export async function register() {
  // Written as an if-block (not an early return) so webpack drops the Node-only import from the Edge build.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("@/lib/core/db");
    const { createLogger } = await import("@/lib/core/logger");
    try {
      await (await getDb()).query("select 1");
    } catch (err) {
      // The first request retries and reports it; the server still starts.
      createLogger("startup").error({ err }, "Database warm-up failed");
    }
  }
}
