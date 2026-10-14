import { LedgerError } from "../../domain/errors";
import { currentCommissionBasisPoints, getRacetrack } from "../../domain/racetracks";
import type { DailySale, RacetrackId, TerminalId } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type RecordDayInput = {
  date: string;
  racetrackId: string;
  terminalId?: TerminalId;
  soldCents: number;
  cancelledCents: number;
  paidCents: number;
};

const terminalIds: readonly TerminalId[] = ["1", "2", "3", "4"];

export function isTerminalId(value: string | undefined): value is TerminalId {
  return terminalIds.some((id) => id === value);
}

/** A row without a terminal occupies the whole date and racetrack. */
export function daySlotConflict(
  days: readonly DailySale[],
  input: { id?: string; date: string; racetrackId: string; agencyId: string; terminalId?: TerminalId },
): "duplicate-day" | "duplicate-terminal" | null {
  const others = days.filter(
    (day) =>
      day.id !== input.id &&
      day.date === input.date &&
      day.racetrackId === input.racetrackId &&
      day.agencyId === input.agencyId,
  );
  if (others.length === 0) {
    return null;
  }
  if (!input.terminalId || others.some((day) => !day.terminalId)) {
    return "duplicate-day";
  }
  if (others.some((day) => day.terminalId === input.terminalId)) {
    return "duplicate-terminal";
  }
  return null;
}

export function recordDay(repository: LedgerRepository, input: RecordDayInput): DailySale {
  const snapshot = repository.load();
  assertIsoDate(input.date);
  const racetrack = getRacetrack(input.racetrackId, snapshot);
  assertCents(input.soldCents, { allowZero: true });
  assertCents(input.cancelledCents, { allowZero: true });
  assertCents(input.paidCents, { allowZero: true });

  if (input.soldCents === 0 && input.cancelledCents === 0 && input.paidCents === 0) {
    throw new LedgerError("empty-entry");
  }

  const racetrackId = racetrack.id as RacetrackId;
  const terminalId: TerminalId = isTerminalId(input.terminalId) ? input.terminalId : "1";
  const conflict = daySlotConflict(snapshot.days, {
    date: input.date,
    racetrackId,
    agencyId: snapshot.agencyId,
    terminalId,
  });
  if (conflict) {
    throw new LedgerError(conflict);
  }

  const day: DailySale = {
    id: createId("day"),
    agencyId: snapshot.agencyId,
    date: input.date,
    racetrackId,
    terminalId,
    soldCents: input.soldCents,
    cancelledCents: input.cancelledCents,
    paidCents: input.paidCents,
    commissionBasisPoints: currentCommissionBasisPoints(racetrackId, snapshot.commissions, snapshot),
    depositAdjustmentBasisPoints: racetrack.depositAdjustmentBasisPoints,
  };

  repository.save({ ...snapshot, days: [...snapshot.days, day] });
  return day;
}
