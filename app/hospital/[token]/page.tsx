import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HospitalDesk } from "@/components/hospital/HospitalDesk";
import { HOSPITAL_FULL_HOURS } from "@/lib/core/config";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";

export const dynamic = "force-dynamic";

// A private link: keep it out of search results and out of Referer headers.
export const metadata: Metadata = { title: "Haazir · Hospital desk", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function HospitalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await HospitalService.snapshot(token).catch(() => null);
  if (!snapshot) notFound();
  return <HospitalDesk token={token} initial={snapshot} fullHours={HOSPITAL_FULL_HOURS} />;
}
