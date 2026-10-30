import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers load at runtime on the server; don't bundle them.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrations and seed are read from disk (embedded DB bootstrap, demo reset).
  outputFileTracingIncludes: {
    "/**": ["./supabase/**/*.sql", "./docs/08-demo-and-pitch.md"],
  },
};

export default nextConfig;
