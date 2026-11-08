import "server-only";
import { ApiError } from "@/lib/core/error";
import { createLogger } from "@/lib/core/logger";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { parseDirectoryCsv, type ImportIssue, type ImportReport } from "@/lib/modules/facility/import.helper";

const log = createLogger("facility");

/** Listing many hospitals at once from a CSV file (docs/04-api-spec.md §2.11). */
export const ImportService = {
  /**
   * Checks the file, and with `apply` lists every hospital that passed. A check writes nothing. Each hospital goes through
   * `DirectoryService.create`, so it is held to the same rules as one listed by hand; one failing never stops the others.
   */
  run: async (orgId: string, csv: string, apply: boolean): Promise<ImportReport> => {
    const [services, existing] = await Promise.all([FacilityRepository.allCapabilities(), FacilityRepository.listForOrg(orgId)]);
    const { rows, issues } = parseDirectoryCsv(csv, services, existing.map((f) => f.name));
    if (!apply) return { applied: false, hospitals: rows.map((r) => ({ line: r.line, name: r.listing.name })), issues };

    const hospitals: ImportReport["hospitals"] = [];
    const failed: ImportIssue[] = [];
    for (const row of rows) {
      try {
        await DirectoryService.create(orgId, row.listing);
        hospitals.push({ line: row.line, name: row.listing.name });
      } catch (err) {
        if (!(err instanceof ApiError)) log.error({ line: row.line, err }, "directory import row failed");
        failed.push({ line: row.line, name: row.listing.name, message: err instanceof ApiError ? err.message : "Could not be saved." });
      }
    }
    log.info({ org_id: orgId, listed: hospitals.length, not_listed: issues.length + failed.length }, "directory imported");
    return { applied: true, hospitals, issues: [...issues, ...failed].sort((a, b) => a.line - b.line) };
  },
};
