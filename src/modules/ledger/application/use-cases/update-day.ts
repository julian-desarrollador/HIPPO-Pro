import { LedgerError } from "../../domain/errors";
import { currentCommissionBasisPoints, getRacetrack } from "../../domain/racetracks";
import type { DailySale, RacetrackId } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import { daySlotConflict, isTerminalId, type RecordDayInput } from "./record-day";

export type UpdateDayInput = RecordDayInput & { id: string };

export function updateDay(repository: LedgerRepository, input: UpdateDayInput): DailySale {
  const snapshot = repository.load();
  const index = snapshot.days.findIndex((day) => day.id === input.id && day.agencyId === snapshot.agencyId);
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  assertIsoDate(input.date);
  const racetrack = getRacetrack(input.racetrackId, snapshot);
  assertCents(input.soldCents, { allowZero: true });
  assertCents(input.cancelledCents, { allowZero: true });
  assertCents(input.paidCents, { allowZero: true });

  if (input.soldCents === 0 && input.cancelledCents === 0 && input.paidCents === 0) {
    throw new LedgerError("empty-entry");
  }

  const racetrackId = racetrack.id as RacetrackId;
  const current = snapshot.days[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }
  const terminalId = current.terminalId === undefined ? undefined : isTerminalId(input.terminalId) ? input.terminalId : current.terminalId;
  const conflict = daySlotConflict(snapshot.days, {
    id: input.id,
    date: input.date,
    racetrackId,
    agencyId: snapshot.agencyId,
    terminalId,
  });
  if (conflict) {
    throw new LedgerError(conflict);
  }

  const updated: DailySale = {
    ...current,
    date: input.date,
    racetrackId,
    terminalId,
    soldCents: input.soldCents,
    cancelledCents: input.cancelledCents,
    paidCents: input.paidCents,
    commissionBasisPoints:
      current.racetrackId === racetrackId
        ? current.commissionBasisPoints
        : currentCommissionBasisPoints(racetrackId, snapshot.commissions, snapshot),
    depositAdjustmentBasisPoints:
      current.racetrackId === racetrackId ? current.depositAdjustmentBasisPoints : racetrack.depositAdjustmentBasisPoints,
  };
  const days = snapshot.days.slice();
  days[index] = updated;
  repository.save({ ...snapshot, days });
  return updated;
}
