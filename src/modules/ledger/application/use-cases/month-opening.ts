import { canViewAgencyBalances } from "../../domain/access";
import { LedgerError } from "../../domain/errors";
import type { Cents } from "../../domain/money";
import { listRacetracks } from "../../domain/racetracks";
import type { LedgerSnapshot, MonthOpening, RacetrackId, ViewerRole } from "../../domain/types";
import { assertYearMonth } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import { racetrackOpeningCents, withOpening } from "./manage-racetracks";
import { carriedOpeningCents, monthOpeningAt } from "./summarize-month";

export type MonthStartLine = {
  racetrackId: RacetrackId;
  name: string;
  /** What the month starts with when nothing is written for it. */
  carriedCents: Cents;
  /** What the month starts with now: the written balance, or the carried one. */
  openingCents: Cents;
  /** True when the owner wrote a balance for this month that replaces the carried one. */
  written: boolean;
};

export type MonthStart = {
  month: string;
  /** The first month of the book. Its balance is the starting balance, not a cut. */
  firstMonth: boolean;
  lines: MonthStartLine[];
  totalCents: Cents;
};

/** Balance with each racetrack on the 1st of `month`. Positive: the agency owes. */
export function monthStartBalances(snapshot: LedgerSnapshot, month: string): MonthStart {
  const firstMonth = month === snapshot.month;
  const lines = listRacetracks(snapshot).map((racetrack) => {
    const written = firstMonth ? null : monthOpeningAt(snapshot, month, racetrack.id);
    const carriedCents = firstMonth ? 0 : carriedOpeningCents(snapshot, month, racetrack.id);
    const openingCents = firstMonth ? racetrackOpeningCents(snapshot, racetrack.id) : written ?? carriedCents;
    return { racetrackId: racetrack.id, name: racetrack.name, carriedCents, openingCents, written: written !== null };
  });
  return { month, firstMonth, lines, totalCents: lines.reduce((total, line) => total + line.openingCents, 0) };
}

export type SetMonthOpeningInput = {
  role: ViewerRole;
  month: string;
  /** Year and month of today. A balance cannot be written for a month that has not started. */
  currentMonth: string;
  /** null goes back to the carried balance. */
  balances: readonly { racetrackId: RacetrackId; amountCents: Cents | null }[];
};

/**
 * Writes the balance with each racetrack on the 1st of `month`. In the first month of the book
 * it is the starting balance. In a later month it replaces what was carried, unless it is the same.
 */
export function setMonthOpening(repository: LedgerRepository, input: SetMonthOpeningInput): void {
  if (!canViewAgencyBalances(input.role)) {
    throw new LedgerError("owner-only");
  }
  assertYearMonth(input.month);
  const snapshot = repository.load();
  if (input.month < snapshot.month || input.month > input.currentMonth) {
    throw new LedgerError("invalid-opening-month");
  }
  const known = new Set(listRacetracks(snapshot).map((racetrack) => racetrack.id));
  for (const balance of input.balances) {
    if (!known.has(balance.racetrackId)) {
      throw new LedgerError("unknown-racetrack");
    }
    if (balance.amountCents !== null && !Number.isSafeInteger(balance.amountCents)) {
      throw new LedgerError("invalid-amount");
    }
  }

  if (input.month === snapshot.month) {
    let openingBalances = snapshot.openingBalances;
    for (const balance of input.balances) {
      openingBalances = withOpening(openingBalances, balance.racetrackId, balance.amountCents ?? 0);
    }
    repository.save({ ...snapshot, openingBalances });
    return;
  }

  let monthOpenings: MonthOpening[] = (snapshot.monthOpenings ?? []).slice();
  for (const balance of input.balances) {
    const others = monthOpenings.filter(
      (opening) => !(opening.month === input.month && opening.racetrackId === balance.racetrackId),
    );
    const carried = carriedOpeningCents(snapshot, input.month, balance.racetrackId);
    monthOpenings =
      balance.amountCents === null || balance.amountCents === carried
        ? others
        : [...others, { month: input.month, racetrackId: balance.racetrackId, amountCents: balance.amountCents }];
  }
  repository.save({ ...snapshot, monthOpenings });
}
