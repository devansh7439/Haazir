// Parses a hospital desk's WhatsApp reply to a bed request (C6): "YES R-4821", "haan 4821 send case sheet", "NO R4821 full".
// Returns null for anything that isn't clearly a yes or no, so an ambiguous message is never recorded as an answer.

export interface QuickReply {
  answer: "yes" | "no";
  code: string | null;
  condition: string | null;
}

const YES = /^(yes|y|ok|okay|haan|haa|ha|ji haan|houdu|hoo|accept(?:ed)?|confirmed?)\b/i;
const NO = /^(no|n|nahi|nahin|illa|decline[d]?|full|cannot|can't|cant)\b/i;

export function parseQuickReply(text: string): QuickReply | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  const yes = t.match(YES);
  const no = yes ? null : t.match(NO);
  const m = yes ?? no;
  if (!m) return null;
  let rest = t.slice(m[0].length).trim();
  const codeM = rest.match(/^[,.:-]?\s*\b(?:R\s*[-\s]?\s*)?(\d{4})\b/i);
  const code = codeM ? `R-${codeM[1]}` : null;
  if (codeM) rest = rest.slice(codeM[0].length);
  rest = rest.replace(/^[\s,.:;-]+/, "").trim();
  // A "yes, but…" that is really a no ("yes but no ventilator") is treated as unclear.
  if (yes && /\b(no|not|nahi|illa)\b/i.test(rest)) return null;
  return { answer: yes ? "yes" : "no", code, condition: rest ? rest.slice(0, 200) : null };
}
