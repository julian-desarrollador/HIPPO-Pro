import { EXPENSE_CATEGORIES } from "../../domain/expense-categories";
import { RACETRACKS } from "../../domain/racetracks";
import type { LedgerSnapshot } from "../../domain/types";
import { createAugust2026Snapshot, PREVIEW_AGENCY_ID } from "./august-2026-seed";

function localYearMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * A new agency starts with no movements and without the racetracks and partner
 * categories of Agencia Dolores. Keep aligned with emptyAgencySnapshot in
 * supabase/functions/create-agency/index.ts.
 */
export function createEmptyAgencySnapshot(agencyId: string, now = new Date()): LedgerSnapshot {
  return {
    agencyId,
    month: localYearMonth(now),
    days: [],
    deposits: [],
    expenses: [],
    openingBalances: [],
    hiddenRacetrackIds: RACETRACKS.map((racetrack) => racetrack.id),
    hiddenCategoryIds: EXPENSE_CATEGORIES.filter((category) => category.kind === "partner-withdrawal").map((category) => category.id),
  };
}

/** Only Agencia Dolores starts from the August spreadsheet. */
export function startingSnapshot(agencyId: string): LedgerSnapshot {
  return agencyId === PREVIEW_AGENCY_ID ? createAugust2026Snapshot() : createEmptyAgencySnapshot(agencyId);
}
