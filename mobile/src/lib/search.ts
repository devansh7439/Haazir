/** A search text made ready to compare: trimmed and lower case, so "  Stroke " finds "Acute stroke". */
export const normalizeQuery = (query: string): string => query.trim().toLowerCase();

/** Whether the text a person typed appears in any of the fields; an empty search matches everything. */
export function matches(query: string, ...fields: ReadonlyArray<string | null | undefined>): boolean {
  const q = normalizeQuery(query);
  return q === '' || fields.some((field) => !!field && field.toLowerCase().includes(q));
}
