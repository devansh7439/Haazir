/** A number the doctor can call when no hospital accepted: a district referral officer, a state control room. */
export interface EscalationContact {
  id: string;
  label: string;
  phone_e164: string;
  sort_order: number;
}
