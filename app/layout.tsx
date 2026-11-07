import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { env } from "@/lib/core/config";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ViewService } from "@/lib/modules/referral/view.service";
import { getSession } from "@/lib/modules/auth/session.service";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haazir · Emergency referral router",
  description: "Phones every capable hospital nearby at once and hands the doctor a confirmed bed.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export const dynamic = "force-dynamic";

const IN_PROGRESS = ["searching", "options_ready", "confirming", "confirmed"];

/** The referrals still in progress and the drafts waiting from WhatsApp, for the sidebar and the top bar; empty when signed out. */
async function sideData() {
  try {
    const s = await getSession();
    if (!s) return { live: [], drafts: { count: 0, firstId: null as string | null } };
    const [recent, drafts] = await Promise.all([ViewService.list(s.org, 12), IntakeService.list(s.org)]);
    return {
      live: recent.filter((r) => IN_PROGRESS.includes(r.status)).slice(0, 4),
      drafts: { count: drafts.length, firstId: drafts[0]?.id ?? null },
    };
  } catch {
    return { live: [], drafts: { count: 0, firstId: null as string | null } };
  }
}

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
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const live = !!env.bolnaApiKey && !!env.agentId("availability");
  const side = await sideData();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppShell user={await currentUser()} mode={live ? "live" : "not_configured"} live={side.live} drafts={side.drafts}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
