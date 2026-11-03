/** The private patient and family fields. They are never spoken on calls. */
export interface PatientFields {
  patient_name: string;
  attendant_name: string;
  attendant_phone: string;
  attendant_language: string;
  /** The attendant agreed to their details being shared and to a WhatsApp update. */
  attendant_consent: boolean;
}

export const EMPTY_PATIENT: PatientFields = {
  patient_name: "",
  attendant_name: "",
  attendant_phone: "",
  attendant_language: "en",
  attendant_consent: false,
};
