import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { env } from "@/lib/core/config";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { getSession } from "@/lib/modules/auth/session.service";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
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
    const row = await ReferralRepository.defaultReferrer(s.org, s.rid);
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
