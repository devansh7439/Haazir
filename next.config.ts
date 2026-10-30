import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
