import { LedgerError } from "../../domain/errors";
import { currentCommissionBasisPoints, getRacetrack } from "../../domain/racetracks";
import type { DailySale, RacetrackId } from "../../domain/types";
import { assertCents, assertDateInMonth } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import type { RecordDayInput } from "./record-day";

export type UpdateDayInput = RecordDayInput & { id: string };

export function updateDay(repository: LedgerRepository, input: UpdateDayInput): DailySale {
  const snapshot = repository.load();
  const index = snapshot.days.findIndex((day) => day.id === input.id && day.agencyId === snapshot.agencyId);
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  assertDateInMonth(input.date, snapshot.month);
  const racetrack = getRacetrack(input.racetrackId);
  assertCents(input.soldCents, { allowZero: true });
  assertCents(input.cancelledCents, { allowZero: true });
  assertCents(input.paidCents, { allowZero: true });

  if (input.soldCents === 0 && input.cancelledCents === 0 && input.paidCents === 0) {
    throw new LedgerError("empty-entry");
  }

  const racetrackId = racetrack.id as RacetrackId;
  const duplicate = snapshot.days.some(
    (day) =>
      day.id !== input.id &&
      day.date === input.date &&
      day.racetrackId === racetrackId &&
      day.agencyId === snapshot.agencyId,
  );
  if (duplicate) {
    throw new LedgerError("duplicate-day");
  }

  const current = snapshot.days[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }
  const updated: DailySale = {
    ...current,
    date: input.date,
    racetrackId,
    soldCents: input.soldCents,
    cancelledCents: input.cancelledCents,
    paidCents: input.paidCents,
    commissionBasisPoints:
      current.racetrackId === racetrackId
        ? current.commissionBasisPoints
        : currentCommissionBasisPoints(racetrackId, snapshot.commissions),
  };
  const days = snapshot.days.slice();
  days[index] = updated;
  repository.save({ ...snapshot, days });
  return updated;
}
