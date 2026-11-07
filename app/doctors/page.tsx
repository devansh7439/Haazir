import { notFound } from "next/navigation";
import { DoctorsAdmin } from "@/components/doctors/DoctorsAdmin";
import { MyRegistration } from "@/components/doctors/MyRegistration";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

/** An admin sees every doctor and verifies them; a doctor sees only their own registration. */
export default async function DoctorsPage() {
  const s = await SessionService.page();
  const doctors = JSON.parse(JSON.stringify(await RegistrationService.list(s.org)));
  if (s.role === "admin") return <DoctorsAdmin initial={doctors} />;
  const mine = doctors.find((d: { id: string }) => d.id === s.rid);
  if (!mine) notFound();
  return <MyRegistration doctor={mine} />;
}
