import type { LotterySnapshot } from "../../domain/lottery";

export function isLotterySnapshot(value: unknown): value is LotterySnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snapshot = value as LotterySnapshot;
  return (
    typeof snapshot.agencyId === "string" &&
    typeof snapshot.month === "string" &&
    typeof snapshot.activatedAt === "string" &&
    Array.isArray(snapshot.games) &&
    Array.isArray(snapshot.sales) &&
    Array.isArray(snapshot.deposits) &&
    Array.isArray(snapshot.expenses) &&
    Array.isArray(snapshot.audit) &&
    Number.isInteger(snapshot.openingCents)
  );
}
