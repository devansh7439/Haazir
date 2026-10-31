import type { ReactNode } from "react";

/** Minimal inline markdown for the pitch doc: **bold**, and unfilled {placeholders} highlighted so nobody reads them out. */
export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part, i) => {
    const bold = part.startsWith("**") && part.endsWith("**");
    const body = bold ? part.slice(2, -2) : part;
    const pieces = body.split(/(\{[^}]+\})/g).map((p, j) =>
      /^\{[^}]+\}$/.test(p) ? (
        <mark key={j} className="rounded bg-amber-100 px-1 text-amber-900" title="Not measured yet: fill in before you say it">{p}</mark>
      ) : (
        p
      ),
    );
    out.push(bold ? <strong key={i} className="font-semibold text-zinc-900">{pieces}</strong> : <span key={i}>{pieces}</span>);
  });
  return <>{out}</>;
}
