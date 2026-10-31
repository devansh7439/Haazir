import type { MeasuredRow } from "@/lib/modules/demo/pitch.repository";
import { mmss } from "@/lib/ui/display";

// The presenter run sheet reads docs/08-demo-and-pitch.md directly, so the script has one source of truth.
// Placeholders the doc leaves for real numbers ({TTFA}, {N}, {X}, {answer rate}) are filled only from measured,
// non-simulated data; anything not measured yet stays visibly unfilled. The doc's own rule: only say numbers you measured.

export interface MdTable {
  header: string[];
  rows: string[][];
}

/** Splits a markdown document into sections by "## " heading and returns the first table under the matching heading. */
export function tableUnder(md: string, heading: string): MdTable | null {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.toLowerCase().includes(heading.toLowerCase()));
  if (start < 0) return null;
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) {
    const l = lines[i].trim();
    if (!l.startsWith("|")) {
      if (rows.length) break;
      continue;
    }
    if (/^\|[\s|:-]+\|$/.test(l)) continue; // separator row
    rows.push(l.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
  }
  if (rows.length === 0) return null;
  return { header: rows[0], rows: rows.slice(1) };
}

export interface Measured {
  ttfa: string | null; // latest real referral
  n: number; // real referrals that got a yes
  median: string | null;
  answerRate: string | null;
}

/** Measured numbers as the run sheet shows them; null for anything not measured yet. */
export function measuredFrom(row: MeasuredRow | null): Measured {
  return {
    ttfa: row?.latest != null ? mmss(row.latest) : null,
    n: row?.n ?? 0,
    median: row?.median != null ? mmss(Math.round(row.median)) : null,
    answerRate: row && row.calls > 0 ? `${Math.round((100 * row.answered) / row.calls)}%` : null,
  };
}

/** Replaces {TTFA}, {N}, {X} and {answer rate} with measured values; unknown placeholders are left for the team. */
export function fillPlaceholders(text: string, m: Measured): string {
  return text
    .replace(/\{TTFA\}/g, m.ttfa ?? "{TTFA}")
    .replace(/\{N\}/g, m.n > 0 ? String(m.n) : "{N}")
    .replace(/\{X\}/g, m.median ?? "{X}")
    .replace(/\{answer rate\}/g, m.answerRate ?? "{answer rate}");
}
