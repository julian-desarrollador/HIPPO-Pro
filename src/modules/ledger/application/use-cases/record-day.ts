import { LedgerError } from "../../domain/errors";
import { getRacetrack } from "../../domain/racetracks";
import type { DailySale, RacetrackId } from "../../domain/types";
import { assertCents, assertDateInMonth } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type RecordDayInput = {
  date: string;
  racetrackId: string;
  soldCents: number;
  cancelledCents: number;
  paidCents: number;
};

export function recordDay(repository: LedgerRepository, input: RecordDayInput): DailySale {
  const snapshot = repository.load();
  assertDateInMonth(input.date, snapshot.month);
  const racetrack = getRacetrack(input.racetrackId);
  assertCents(input.soldCents, { allowZero: true });
  assertCents(input.cancelledCents, { allowZero: true });
  assertCents(input.paidCents, { allowZero: true });

  if (input.soldCents === 0 && input.cancelledCents === 0 && input.paidCents === 0) {
    throw new LedgerError("empty-entry");
  }

  const racetrackId = racetrack.id as RacetrackId;
  const exists = snapshot.days.some(
    (day) => day.date === input.date && day.racetrackId === racetrackId && day.agencyId === snapshot.agencyId,
  );
  if (exists) {
    throw new LedgerError("duplicate-day");
  }

  const day: DailySale = {
    id: createId("day"),
    agencyId: snapshot.agencyId,
    date: input.date,
    racetrackId,
    soldCents: input.soldCents,
    cancelledCents: input.cancelledCents,
    paidCents: input.paidCents,
  };

  repository.save({ ...snapshot, days: [...snapshot.days, day] });
  return day;
}
