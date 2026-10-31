/** How many rows the retention purge deleted, per table. */
export interface PurgeResult {
  patient_details: number;
  messages: number;
  intake_drafts: number;
  webhook_log: number;
}
