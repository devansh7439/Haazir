/** The two pages of the full form. */
export type Page = "case" | "patient";

/** What the form still needs before it can be sent, as the hint under the button; null when nothing is missing. */
export const missingStep = (caseType: string, acuity: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : !acuity ? "Set the acuity" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

/** The page of the full form that is missing something, as the hint under "Continue"; null when the case page is complete. */
export const missingCase = (caseType: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;
