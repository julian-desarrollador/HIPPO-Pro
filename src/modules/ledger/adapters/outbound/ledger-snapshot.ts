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
    Array.isArray(snapshot.openingBalances)
  );
}
