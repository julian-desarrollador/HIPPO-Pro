import type { LedgerSnapshot } from "../../domain/types";

export function isLedgerSnapshot(value: unknown): value is LedgerSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as LedgerSnapshot;
  return (
    typeof snapshot.agencyId === "string" &&
    typeof snapshot.month === "string" &&
    Array.isArray(snapshot.days) &&
    Array.isArray(snapshot.deposits) &&
    Array.isArray(snapshot.expenses) &&
    Array.isArray(snapshot.openingBalances) &&
    (snapshot.racetracks === undefined || Array.isArray(snapshot.racetracks)) &&
    (snapshot.hiddenRacetrackIds === undefined || Array.isArray(snapshot.hiddenRacetrackIds)) &&
    (snapshot.expenseCategories === undefined || Array.isArray(snapshot.expenseCategories)) &&
    (snapshot.categoryLabels === undefined || Array.isArray(snapshot.categoryLabels)) &&
    (snapshot.hiddenCategoryIds === undefined || Array.isArray(snapshot.hiddenCategoryIds)) &&
    (snapshot.bettors === undefined || Array.isArray(snapshot.bettors)) &&
    (snapshot.bettorPlays === undefined || Array.isArray(snapshot.bettorPlays)) &&
    (snapshot.bettorPayments === undefined || Array.isArray(snapshot.bettorPayments)) &&
    (snapshot.audit === undefined || Array.isArray(snapshot.audit))
  );
}
