import { Segmented } from "./PatientSection";
import { CONSENTS, REASONS } from "./options";
import type { TransferFields } from "./types";

/** Who agreed to the transfer and why the patient is being sent. Kept on the referral and printed on the referral slip. */
export function TransferSection(props: { transfer: TransferFields; onChange: (t: TransferFields) => void }) {
  const { transfer } = props;
  return (
    <>
      <div className="grid gap-1.5">
        <span className="label mb-0">Consent to the transfer</span>
        <Segmented name="consent" label="Consent to the transfer" value={transfer.consent} options={CONSENTS} onChange={(v) => props.onChange({ ...transfer, consent: v })} />
      </div>
      <div className="grid gap-1.5">
        <span className="label mb-0">Reason for transfer</span>
        <Segmented name="reason" label="Reason for transfer" value={transfer.reason} options={REASONS} onChange={(v) => props.onChange({ ...transfer, reason: v })} />
      </div>
      {transfer.consent === "emergency_waiver" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Write the reason the patient could not consent in your own case sheet. Haazir records only that consent was waived.
        </p>
      )}
    </>
  );
}
