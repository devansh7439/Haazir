// WhatsApp message bodies (docs/04-api-spec.md §4). Pure functions.
// Each template renders twice: the real body (stored server-only in `messages`) and a redacted
// preview (patient name and phone numbers masked) that goes into `events` for the console.

import { maskPhone } from "@/lib/core/normalize";

export const BED_TYPE_LABEL: Record<string, string> = {
  icu_with_ventilator: "ICU + ventilator",
  icu: "ICU",
  hdu: "HDU",
  nicu: "NICU",
  emergency_only: "Emergency only",
  ward: "Ward",
  none: "None",
  unknown: "Bed type not stated",
};

export interface HandoffFacts {
  code: string;
  doctor_name: string;
  doctor_phone: string;
  referring_facility: string;
  patient_name: string | null;
  who: string;
  case_label: string;
  acuity: string;
  note: string | null;
  needs_labels: string[];
  eta_minutes: number | null;
  transport: string;
  contact_person: string | null;
  confirmed_time: string;
  hospital_name: string;
  hospital_address: string | null;
  hospital_lat: number;
  hospital_lng: number;
  desk_number: string;
  bed_type: string | null;
  conditions: string | null;
  hold_until_time: string;
  aapat_setu_url?: string | null;
}

export type TemplateKey = "prearrival" | "doctor" | "family" | "bed_request";

export interface Rendered {
  body: string;
  preview_redacted: string;
  /** Approved-template form of the same message (Meta requires templates for business-initiated messages). */
  template?: { key: TemplateKey; language: string; params: string[] };
}

/** Meta rejects template parameters that are empty or contain newlines, tabs or 4+ consecutive spaces. */
export function templateParam(value: string | number | null | undefined): string {
  const s = String(value ?? "").replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim();
  return s.length ? s.slice(0, 1000) : "—";
}

const REDACTED_NAME = "●●●●";

function lines(parts: Array<string | null | false | undefined>): string {
  return parts.filter((p): p is string => !!p).join("\n");
}

function transportLabel(t: string): string {
  return t === "private_vehicle" ? "private vehicle" : t === "ambulance" ? "ambulance" : "road";
}

export function preArrivalNote(f: HandoffFacts): Rendered {
  const render = (name: string | null, phone: string) =>
    lines([
      `Haazir · Incoming referral ${f.code}`,
      `From: ${f.doctor_name}, ${f.referring_facility} · ${phone}`,
      `Patient: ${name ? `${name} · ` : ""}${f.who}, ${f.case_label}, ${f.acuity}`,
      f.note && `Note: ${f.note}`,
      f.needs_labels.length > 0 && `Needs: ${f.needs_labels.join(", ")}`,
      f.eta_minutes !== null && `ETA: about ${f.eta_minutes} min by ${transportLabel(f.transport)}`,
      f.contact_person && `Confirmed by: ${f.contact_person} at ${f.confirmed_time}`,
      `Questions: call ${phone}`,
      f.aapat_setu_url && `Aapat Setu: ${f.aapat_setu_url}`,
    ]);
  return {
    body: render(f.patient_name, f.doctor_phone),
    preview_redacted: render(f.patient_name ? REDACTED_NAME : null, maskPhone(f.doctor_phone)),
    template: {
      key: "prearrival",
      language: "en",
      params: [
        f.code,
        `${f.doctor_name}, ${f.referring_facility} · ${f.doctor_phone}`,
        `${f.patient_name ? `${f.patient_name} · ` : ""}${f.who}, ${f.case_label}, ${f.acuity}`,
        f.note,
        f.needs_labels.join(", "),
        f.eta_minutes !== null ? `about ${f.eta_minutes} min by ${transportLabel(f.transport)}` : null,
        f.contact_person ? `${f.contact_person} at ${f.confirmed_time}` : null,
        f.doctor_phone,
        f.aapat_setu_url ?? null,
      ].map(templateParam),
    },
  };
}

export function doctorConfirmation(f: HandoffFacts): Rendered {
  const render = (desk: string) =>
    lines([
      `Haazir · ${f.code} confirmed`,
      `${f.hospital_name} · about ${f.eta_minutes ?? "?"} min · ${BED_TYPE_LABEL[f.bed_type ?? "unknown"] ?? f.bed_type}`,
      `Ask for: ${f.contact_person || "the casualty desk"} · Desk: ${desk}`,
      f.conditions && `Conditions: ${f.conditions}`,
      `Bed held until ${f.hold_until_time}`,
    ]);
  return {
    body: render(f.desk_number),
    preview_redacted: render(maskPhone(f.desk_number)),
    template: {
      key: "doctor",
      language: "en",
      params: [
        f.code, f.hospital_name, f.eta_minutes ?? "?", BED_TYPE_LABEL[f.bed_type ?? "unknown"] ?? f.bed_type,
        f.contact_person || "the casualty desk", f.desk_number, f.conditions, f.hold_until_time,
      ].map(templateParam),
    },
  };
}

export function mapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

const FAMILY: Record<string, (v: Record<string, string>) => string> = {
  en: (v) =>
    `Haazir referral ${v.code}: Dr. ${v.doctor_name} has arranged treatment for the patient at ${v.hospital_name}. Address: ${v.hospital_address}. Map: ${v.map_link}. Show this message at the casualty desk and ask for ${v.contact_person}.`,
  kn: (v) =>
    `ಹಾಜಿರ್ ರೆಫರಲ್ ${v.code}: ಡಾ. ${v.doctor_name} ಅವರು ರೋಗಿಗೆ ${v.hospital_name} ನಲ್ಲಿ ಚಿಕಿತ್ಸೆಯ ವ್ಯವಸ್ಥೆ ಮಾಡಿದ್ದಾರೆ. ವಿಳಾಸ: ${v.hospital_address}. ನಕ್ಷೆ: ${v.map_link}. ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್‌ನಲ್ಲಿ ಈ ಸಂದೇಶವನ್ನು ತೋರಿಸಿ ಮತ್ತು ${v.contact_person} ಅವರನ್ನು ಕೇಳಿ.`,
  hi: (v) =>
    `हाज़िर रेफ़रल ${v.code}: डॉ. ${v.doctor_name} ने मरीज़ के इलाज की व्यवस्था ${v.hospital_name} में की है। पता: ${v.hospital_address}। नक्शा: ${v.map_link}। कैज़ुअल्टी डेस्क पर यह संदेश दिखाएँ और ${v.contact_person} से मिलें।`,
};

export function familyMessage(f: HandoffFacts, language: string): Rendered {
  const lang = FAMILY[language] ? language : "en";
  const tpl = FAMILY[lang];
  const vars = {
    code: f.code,
    doctor_name: f.doctor_name.replace(/^Dr\.?\s*/i, ""),
    hospital_name: f.hospital_name,
    hospital_address: f.hospital_address || f.hospital_name,
    map_link: mapLink(f.hospital_lat, f.hospital_lng),
    contact_person: f.contact_person || (lang === "kn" ? "ಕ್ಯಾಶುವಾಲ್ಟಿ ಡೆಸ್ಕ್" : lang === "hi" ? "कैज़ुअल्टी डेस्क" : "the casualty desk"),
  };
  const body = tpl(vars);
  // No patient identifiers in this body; the recipient number is masked in the event instead.
  return {
    body,
    preview_redacted: body,
    template: {
      key: "family",
      language: lang,
      params: [vars.code, vars.doctor_name, vars.hospital_name, vars.hospital_address, vars.map_link, vars.contact_person].map(templateParam),
    },
  };
}

/** WhatsApp bed request to a hospital desk (C6). No identifiers: the same facts the voice agent reads out. */
export function bedRequestMessage(opts: { code: string; doctor_name: string; referring_facility: string; case_summary: string }): Rendered {
  const from = `${opts.doctor_name}, ${opts.referring_facility}`;
  const body = lines([
    `Haazir · Bed request ${opts.code} from ${from}`,
    opts.case_summary,
    `Can you accept this patient now? Reply YES ${opts.code} or NO ${opts.code}. Add any condition after YES.`,
    "We are also calling your desk.",
  ]);
  return {
    body,
    preview_redacted: body,
    template: { key: "bed_request", language: "en", params: [opts.code, from, opts.case_summary, opts.code, opts.code].map(templateParam) },
  };
}
