import { LedgerError } from "../../domain/errors";
import { getRacetrack } from "../../domain/racetracks";
import type { HippodromeDeposit, RacetrackId } from "../../domain/types";
import { assertCents, assertDateInMonth } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import type { RecordDepositInput } from "./record-deposit";

export type UpdateDepositInput = RecordDepositInput & { id: string };

export function updateDeposit(repository: LedgerRepository, input: UpdateDepositInput): HippodromeDeposit {
  const snapshot = repository.load();
  const index = snapshot.deposits.findIndex(
    (deposit) => deposit.id === input.id && deposit.agencyId === snapshot.agencyId,
  );
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  assertDateInMonth(input.date, snapshot.month);
  const racetrack = getRacetrack(input.racetrackId);
  assertCents(input.amountCents, { allowZero: false });

  const current = snapshot.deposits[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }
  const updated: HippodromeDeposit = {
    ...current,
    date: input.date,
    racetrackId: racetrack.id as RacetrackId,
    amountCents: input.amountCents,
  };
  const deposits = snapshot.deposits.slice();
  deposits[index] = updated;
  repository.save({ ...snapshot, deposits });
  return updated;
}
