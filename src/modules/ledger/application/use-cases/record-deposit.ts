import { getRacetrack } from "../../domain/racetracks";
import type { HippodromeDeposit, RacetrackId } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type RecordDepositInput = {
  date: string;
  racetrackId: string;
  amountCents: number;
};

export function recordDeposit(repository: LedgerRepository, input: RecordDepositInput): HippodromeDeposit {
  const snapshot = repository.load();
  assertIsoDate(input.date);
  const racetrack = getRacetrack(input.racetrackId, snapshot);
  assertCents(input.amountCents, { allowZero: false });

  const deposit: HippodromeDeposit = {
    id: createId("deposit"),
    agencyId: snapshot.agencyId,
    date: input.date,
    racetrackId: racetrack.id as RacetrackId,
    amountCents: input.amountCents,
  };

  repository.save({ ...snapshot, deposits: [...snapshot.deposits, deposit] });
  return deposit;
}
