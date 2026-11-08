import { describe, expect, it } from "vitest";
import { IMPORT_MAX_ROWS, parseCsv, parseDirectoryCsv } from "@/lib/modules/facility/import.helper";

const SERVICES = [
  { code: "icu_bed", label: "ICU bed" },
  { code: "ventilator", label: "Ventilator" },
];
const HEADER = "name,kind,city,lat,lng,language,casualty_phone,referral_phone,services";
const parse = (body: string, existing: string[] = []) => parseDirectoryCsv(`${HEADER}\n${body}`, SERVICES, existing);

describe("reading CSV", () => {
  it("handles quotes, commas and line breaks inside quotes, and CRLF", () => {
    const rows = parseCsv('a,"b, c","say ""hi"""\r\n"two\nlines",x,\n\n');
    expect(rows.map((r) => r.cells)).toEqual([["a", "b, c", 'say "hi"'], ["two\nlines", "x", ""]]);
  });

  it("numbers each row by the line it starts on", () => {
    expect(parseCsv("h\n\nfirst\n\nsecond").map((r) => r.line)).toEqual([1, 3, 5]);
  });
});

describe("importing a hospital directory", () => {
  it("turns a row into a listing with its numbers and services, by code or by name", () => {
    const { rows, issues } = parse('Tamarind District Hospital,District Hospital,Hoskote,13.07,77.79,kn,080 2345 6789,9845012345,ICU bed;ventilator');
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].listing).toMatchObject({
      name: "Tamarind District Hospital",
      kind: "district_hospital",
      city: "Hoskote",
      lat: 13.07,
      lng: 77.79,
      call_language: "kn",
      capabilities: ["icu_bed", "ventilator"],
    });
    expect(rows[0].listing.contacts).toEqual([
      { role: "casualty_desk", phone: "+918023456789", priority: 1, is_ivr: false },
      { role: "referral_desk", phone: "+919845012345", priority: 2, is_ivr: false },
    ]);
  });

  it("accepts the common names for the columns", () => {
    const csv = "Hospital,Type,Latitude,Longitude,Phone\nBanyan,private hospital,13.1,77.8,9845012345";
    const { rows, issues } = parseDirectoryCsv(csv, SERVICES, []);
    expect(issues).toEqual([]);
    expect(rows[0].listing).toMatchObject({ name: "Banyan", kind: "private_hospital", lat: 13.1, lng: 77.8 });
  });

  it("says which required columns are missing, and imports nothing", () => {
    const { rows, issues } = parseDirectoryCsv("name,city\nBanyan,Hoskote", SERVICES, []);
    expect(rows).toEqual([]);
    expect(issues[0].message).toMatch(/kind, lat, lng/);
  });

  it("reports a bad line with its number and still takes the good ones", () => {
    const { rows, issues } = parse([
      "Good,phc,Hoskote,13.1,77.8,en,9845012345,,ICU bed",
      "Bad phone,phc,Hoskote,13.1,77.8,en,12345,,",
      "Bad service,phc,Hoskote,13.1,77.8,en,9845012346,,Cath lab",
      "Bad place,phc,Hoskote,,77.8,en,9845012347,,",
      "Bad kind,castle,Hoskote,13.1,77.8,en,9845012348,,",
    ].join("\n"));
    expect(rows.map((r) => r.listing.name)).toEqual(["Good"]);
    expect(issues.map((i) => [i.line, i.name])).toEqual([[3, "Bad phone"], [4, "Bad service"], [5, "Bad place"], [6, "Bad kind"]]);
    expect(issues[0].message).toMatch(/not a valid phone number/);
    expect(issues[1].message).toBe("Unknown service: Cath lab.");
  });

  it("skips a hospital already listed, and one listed twice in the file", () => {
    const { rows, issues } = parse(["Tamarind,phc,Hoskote,13.1,77.8,en,9845012345,,", "tamarind,phc,Hoskote,13.1,77.8,en,9845012346,,", "Banyan,phc,Hoskote,13.1,77.8,en,9845012347,,", "BANYAN,phc,Hoskote,13.1,77.8,en,9845012348,,"].join("\n"), ["Tamarind"]);
    expect(rows.map((r) => r.listing.name)).toEqual(["Banyan"]);
    expect(issues.map((i) => i.message)).toEqual(["Already listed.", "Already listed.", "Already listed."]);
  });

  it("refuses the same number as casualty and referral desk", () => {
    const { rows, issues } = parse("Twin,phc,Hoskote,13.1,77.8,en,9845012345,9845012345,");
    expect(rows).toEqual([]);
    expect(issues[0].message).toMatch(/same/);
  });

  it("stops at the row limit and says so", () => {
    const body = Array.from({ length: IMPORT_MAX_ROWS + 3 }, (_, i) => `H${i},phc,X,13.1,77.8,en,98450${String(10000 + i)},,`).join("\n");
    const { rows, issues } = parse(body);
    expect(rows).toHaveLength(IMPORT_MAX_ROWS);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/at most 200/);
  });

  it("reports an empty file", () => {
    expect(parseDirectoryCsv("", SERVICES, []).issues[0].message).toBe("The file is empty.");
  });
});
