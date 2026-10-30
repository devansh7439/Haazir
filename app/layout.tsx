import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { env } from "@/lib/config";
import { one } from "@/lib/db";
import { getSession } from "@/lib/session";
import { DEFAULT_ORG_ID } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haazir · Emergency referral router",
  description: "Phones every capable hospital nearby at once and hands the doctor a confirmed bed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export const dynamic = "force-dynamic";

async function currentUser() {
  try {
    const s = await getSession();
    if (!s) return null;
    const row = await one<{ name: string; facility: string | null }>(
      `select r.name, f.name as facility from referrers r left join facilities f on f.id = r.facility_id
       where r.org_id = $1 and ($2::uuid is null or r.id = $2) order by r.created_at limit 1`,
      [s.org, s.rid],
    );
    const strip = (x: string | null | undefined) => x?.replace(/\s*\(Demo\)/i, "") ?? null;
    return {
      name: s.name || strip(row?.name) || "Console",
      facility: strip(row?.facility),
      signOut: env.authMode === "users" || !!env.demoPasscode,
      showDemo: s.role === "admin" && s.org === DEFAULT_ORG_ID,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const live = !env.simulationMode && !!env.bolnaApiKey && !!env.agentId("availability");
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell user={await currentUser()} mode={live ? "live" : "simulation"}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
