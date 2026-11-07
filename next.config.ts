import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `bun run dev` and `bun run serve` must not write to the same folder: a dev server sharing `.next` overwrites the production
  // build's files and leaves the served page without CSS or scripts. They still share port 3000, so run one at a time
  // (`scripts/ensure-port-free.mjs` stops the second one with a message). Restart the dev server after editing this file.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  poweredByHeader: false,
  // Pin the workspace root to this folder; a stray lockfile higher up otherwise makes Next watch and trace the whole parent directory.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // Database drivers load at runtime on the server; don't bundle them.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrations and seed are read from disk (embedded DB bootstrap, demo reset).
  outputFileTracingIncludes: {
    "/**": ["./supabase/**/*.sql", "./docs/08-demo-and-pitch.md"],
  },
  // The console can't be framed (clickjacking a "Select" or "Cancel referral"), and the browser gets nothing it doesn't need.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
