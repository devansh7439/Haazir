import { z } from "zod";

// Shared pieces of the request-body schemas (CLAUDE.md rule 9). Each module keeps its own bodies in
// `<area>.validation.ts`. Bolna payloads are not validated with zod: they are normalised (lib/core/normalize.ts),
// because every value arrives as a string and may be "None" or an unreplaced %(name)s token.

/** Optional free text, trimmed and capped; an empty string becomes null. */
export const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** A two-letter language code ("en", "kn", "hi"). */
export const languageCode = z.string().regex(/^[a-z]{2}$/);
