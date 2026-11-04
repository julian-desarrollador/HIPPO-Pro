import { isLedgerSnapshot } from "../ledger/adapters/outbound/ledger-snapshot";
import { isLotterySnapshot } from "../ledger/adapters/outbound/lottery-snapshot";
import { agencyModeFrom, type AgencyMode } from "../ledger/domain/features";
import type { LotterySnapshot } from "../ledger/domain/lottery";
import type { LedgerSnapshot } from "../ledger/domain/types";

/** Another agency opened read-only from Agencias. */
export type OpenedAgency = {
  agencyId: string;
  agencyName: string;
  agencyMode: AgencyMode;
  snapshot: LedgerSnapshot;
  /** Its lottery book. Null when it has none or it does not belong to this agency. */
  lotterySnapshot: LotterySnapshot | null;
};

/**
 * Reads the answer of create-agency (action read). A bad racing book is an error.
 * A missing or foreign lottery book is dropped: the visit still opens, without lottery.
 */
export function openedAgencyFrom(data: unknown, agencyId: string): OpenedAgency | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const snapshot = row.snapshot;
  if (!name || !isLedgerSnapshot(snapshot) || snapshot.agencyId !== agencyId) {
    return null;
  }
  const lottery = row.lotterySnapshot;
  const lotterySnapshot = isLotterySnapshot(lottery) && lottery.agencyId === agencyId ? lottery : null;
  return {
    agencyId,
    agencyName: name,
    agencyMode: agencyModeFrom(row.productMode ?? "racing"),
    snapshot,
    lotterySnapshot,
  };
}
