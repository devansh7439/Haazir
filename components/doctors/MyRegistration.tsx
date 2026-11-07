import { PageHeader, StatusPill } from "@/components/ui";
import { RegistrationForm } from "./RegistrationForm";
import { VERIFICATION, type DoctorRow } from "./status";

/** A doctor's own registration: its status, and the form to send or change the number. */
export function MyRegistration({ doctor }: { doctor: DoctorRow }) {
  const v = VERIFICATION[doctor.verification_status] ?? VERIFICATION.unverified;
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader title="Your registration" description="Hospitals and admins can see that your medical registration was checked." />
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={v.tone} text={v.text} icon={doctor.verification_status === "verified" ? "check" : doctor.verification_status === "rejected" ? "x" : "help"} />
          {doctor.registration_no && <span className="kbd-num text-sm text-zinc-600">{doctor.registration_council} {doctor.registration_no}</span>}
        </div>
        <p className="mb-4 mt-2 text-sm text-zinc-500">{v.hint}</p>
        <RegistrationForm referrerId={doctor.id} number={doctor.registration_no} council={doctor.registration_council} />
      </section>
    </div>
  );
}
