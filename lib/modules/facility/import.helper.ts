import { normalizePhone } from "@/lib/core/normalize";
import { FacilityCreateBody } from "@/lib/modules/facility/facility.validation";
import type { NewListing } from "@/lib/modules/facility/facility.type";

/** The most hospitals one import takes. */
export const IMPORT_MAX_ROWS = 200;

/** A CSV row with the line it starts on, so an error can point at it. */
export interface CsvRow {
  line: number;
  cells: string[];
}

/** A hospital ready to list, and the line it came from. */
export interface ImportRow {
  line: number;
  listing: NewListing;
}

/** A line that is not imported, and why. `name` is null when the line had none. */
export interface ImportIssue {
  line: number;
  name: string | null;
  message: string;
}

export interface ParsedDirectory {
  rows: ImportRow[];
  issues: ImportIssue[];
}

/** What an import did, or with `applied: false`, what it would do. */
export interface ImportReport {
  applied: boolean;
  /** Hospitals that were listed (or, in a check, that would be). */
  hospitals: Array<{ line: number; name: string }>;
  /** Lines that were not imported, each with the reason. */
  issues: ImportIssue[];
}

/** What a column header may be called, mapped to the field it fills. */
const HEADER_ALIASES: Record<string, string> = {
  name: "name", hospital: "name", hospital_name: "name",
  kind: "kind", type: "kind",
  ownership: "ownership",
  address: "address", city: "city", district: "district",
  lat: "lat", latitude: "lat",
  lng: "lng", lon: "lng", long: "lng", longitude: "lng",
  language: "call_language", call_language: "call_language",
  casualty_phone: "casualty_phone", casualty: "casualty_phone", phone: "casualty_phone", casualty_desk: "casualty_phone",
  referral_phone: "referral_phone", referral_desk: "referral_phone",
  whatsapp: "whatsapp_number", whatsapp_number: "whatsapp_number",
  services: "services", capabilities: "services",
};

/** Header text as a field key: "Casualty phone" → "casualty_phone". */
const headerKey = (h: string): string => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** CSV text as rows. Handles quoted cells, commas and line breaks inside quotes, "" for a quote, and CRLF. Skips blank lines. */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  const endRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== "")) rows.push({ line: startLine, cells });
    cells = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") line++;
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") { i++; line++; }
      endRow();
      startLine = line;
    } else cell += c;
  }
  if (cell !== "" || cells.length > 0) endRow();
  return rows;
}

/** "District Hospital" → "district_hospital". */
const slug = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

type ContactCell = { ok: true; contact: NewListing["contacts"][number] | null } | { ok: false; message: string };

/** A desk number as a contact, or an issue message. Empty means none given. */
function contactOf(raw: string | undefined, role: "casualty_desk" | "referral_desk", priority: number): ContactCell {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true, contact: null };
  const phone = normalizePhone(text);
  if (!phone) return { ok: false, message: `"${text}" is not a valid phone number` };
  return { ok: true, contact: { role, phone, priority, is_ivr: false } };
}

/**
 * Hospitals from CSV text. The first row names the columns (name, kind, lat and lng are required; city, district, address,
 * language, casualty_phone, referral_phone, whatsapp and services are optional). Services are separated by ; or | and may be
 * written as a code or as the name shown in Haazir. Each line is checked by the same rules as listing one hospital by hand;
 * a line that fails, or names a hospital already listed, is reported with its line number and the rest still import.
 */
export function parseDirectoryCsv(text: string, services: Array<{ code: string; label: string }>, existingNames: Iterable<string>): ParsedDirectory {
  const table = parseCsv(text);
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  if (table.length === 0) return { rows, issues: [{ line: 1, name: null, message: "The file is empty." }] };

  const columns = table[0].cells.map((h) => HEADER_ALIASES[headerKey(h)] ?? null);
  const missing = ["name", "kind", "lat", "lng"].filter((f) => !columns.includes(f));
  if (missing.length > 0) {
    const message = `The first row must name these columns: ${missing.join(", ")}.`;
    return { rows, issues: [{ line: table[0].line, name: null, message }] };
  }

  const byService = new Map<string, string>();
  for (const s of services) {
    byService.set(s.code.toLowerCase(), s.code);
    byService.set(s.label.toLowerCase(), s.code);
  }
  const seen = new Set([...existingNames].map((n) => n.trim().toLowerCase()));

  for (const [n, { line, cells }] of table.slice(1).entries()) {
    const field = (key: string): string => (cells[columns.indexOf(key)] ?? "").trim();
    const name = field("name");
    const fail = (message: string) => issues.push({ line, name: name || null, message });
    if (n >= IMPORT_MAX_ROWS) {
      fail(`Import at most ${IMPORT_MAX_ROWS} hospitals at a time. Split the file; this line and the ones after it were not read.`);
      break;
    }
    if (seen.has(name.toLowerCase()) && name) { fail("Already listed."); continue; }

    const codes: string[] = [];
    const unknown: string[] = [];
    for (const word of field("services").split(/[;|]/).map((w) => w.trim()).filter(Boolean)) {
      const code = byService.get(word.toLowerCase());
      if (code) codes.push(code);
      else unknown.push(word);
    }
    if (unknown.length > 0) { fail(`Unknown service: ${unknown.join(", ")}.`); continue; }

    const casualty = contactOf(field("casualty_phone"), "casualty_desk", 1);
    const referral = contactOf(field("referral_phone"), "referral_desk", 2);
    const badPhone = [casualty, referral].find((c) => !c.ok);
    if (badPhone && !badPhone.ok) { fail(badPhone.message); continue; }
    const contacts = [casualty, referral].flatMap((c) => (c.ok && c.contact ? [c.contact] : []));

    const parsed = FacilityCreateBody.safeParse({
      name,
      kind: slug(field("kind")),
      ...(field("ownership") ? { ownership: slug(field("ownership")) } : {}),
      address: field("address"),
      city: field("city"),
      district: field("district"),
      lat: field("lat") === "" ? undefined : Number(field("lat")),
      lng: field("lng") === "" ? undefined : Number(field("lng")),
      ...(field("call_language") ? { call_language: field("call_language").toLowerCase() } : {}),
      whatsapp_number: field("whatsapp_number"),
      capabilities: [...new Set(codes)],
      contacts,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fail(`${issue.path.join(".") || "row"}: ${issue.message}`);
      continue;
    }
    if (new Set(contacts.map((c) => c.phone)).size !== contacts.length) {
      fail("The casualty and referral numbers are the same.");
      continue;
    }
    seen.add(name.toLowerCase());
    rows.push({ line, listing: parsed.data });
  }
  return { rows, issues };
}
