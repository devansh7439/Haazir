import "server-only";
import fs from "node:fs";
import path from "node:path";
import { measuredFrom, type Measured } from "@/lib/modules/demo/pitch.helper";
import { PitchRepository } from "@/lib/modules/demo/pitch.repository";

/**
 * The presenter run sheet reads docs/08-demo-and-pitch.md directly, so the script has one source of truth. Its
 * placeholders ({TTFA}, {N}, {X}, {answer rate}) are filled only from measured, non-simulated data; the doc's own
 * rule is to say only numbers you measured.
 */
export const PitchService = {
  readDoc: (): string => fs.readFileSync(path.join(process.cwd(), "docs/08-demo-and-pitch.md"), "utf8"),

  measured: async (orgId: string): Promise<Measured> => measuredFrom(await PitchRepository.measured(orgId)),
};
