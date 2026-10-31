/** A demo hospital as the Demo page shows it. */
export interface DemoFacility {
  facility_id: string;
  name: string;
  judge_card: number | null;
  call_language: string;
  contact_id: string | null;
  phone: string | null;
  whatsapp: string | null;
}

/** Phones to put on the demo hospitals, the doctor and the family. `undefined` leaves a value as it is; `null` clears it. */
export interface NumberAssignments {
  assignments: Array<{ facility_id: string; phone: string | null; whatsapp: string | null }>;
  referrer_phone: string | null;
  family_phone: string | null;
}
