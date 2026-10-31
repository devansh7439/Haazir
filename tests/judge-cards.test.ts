import { describe, expect, it } from "vitest";
import { JUDGE_CARDS } from "@/lib/modules/demo/judge-cards.helper";
import { scenario } from "@/lib/modules/demo/simulator.service";

// The printed cards must match the scripted story, or the people playing the desks read the wrong lines.

describe("judge cards", () => {
  it("has one card per number, each with lines to read and a language", () => {
    expect(JUDGE_CARDS.map((c) => c.card)).toEqual([...new Set(JUDGE_CARDS.map((c) => c.card))].sort((a, b) => a - b));
    for (const c of JUDGE_CARDS) {
      expect(c.lines.length).toBeGreaterThan(0);
      expect(c.language).toMatch(/English|Hindi|Kannada/);
    }
  });

  it("covers exactly the hospitals the scenario gives a judge card to", () => {
    const scripted = Object.entries(scenario.availability).filter(([, a]) => a.judge_card !== undefined).map(([id, a]) => [a.judge_card, id]);
    for (const [card, id] of scripted) expect(JUDGE_CARDS.find((c) => c.card === card)?.facility_id).toBe(id);
  });
});
