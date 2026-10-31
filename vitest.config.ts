import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Bun loads .env.local into every script. Without this, a test that reaches the default connection would open the
    // same on-disk database as a running dev or production server, and the two would collide.
    env: { DATABASE_URL: "pglite:memory" },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
