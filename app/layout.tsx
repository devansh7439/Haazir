import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { env } from "@/lib/config";
import { one } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haazir · Emergency referral router",
  description: "Phones every capable hospital nearby at once and hands the doctor a confirmed bed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export const dynamic = "force-dynamic";

async function currentDoctor() {
  try {
    const row = await one<{ name: string; facility: string | null }>(
      `select r.name, f.name as facility from referrers r left join facilities f on f.id = r.facility_id order by r.created_at limit 1`,
    );
    return row ? { name: row.name.replace(/\s*\(Demo\)/i, ""), facility: row.facility?.replace(/\s*\(Demo\)/i, "") ?? null } : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const live = !env.simulationMode && !!env.bolnaApiKey && !!env.agentId("availability");
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell doctor={await currentDoctor()} mode={live ? "live" : "simulation"}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
