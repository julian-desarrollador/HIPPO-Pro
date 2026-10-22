import { LedgerError } from "../../domain/errors";
import type { LotteryDeposit } from "../../domain/lottery";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";

export type RecordLotteryDepositInput = {
  date: string;
  amountCents: number;
};

export type UpdateLotteryDepositInput = RecordLotteryDepositInput & { id: string };

export function recordLotteryDeposit(repository: LotteryRepository, input: RecordLotteryDepositInput): LotteryDeposit {
  const snapshot = requireLottery(repository);
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });
  const deposit: LotteryDeposit = {
    id: createId("lottery-deposit"),
    agencyId: snapshot.agencyId,
    date: input.date,
    amountCents: input.amountCents,
  };
  repository.save({ ...snapshot, deposits: [...snapshot.deposits, deposit] });
  return deposit;
}

export function updateLotteryDeposit(repository: LotteryRepository, input: UpdateLotteryDepositInput): void {
  const snapshot = requireLottery(repository);
  if (!snapshot.deposits.some((deposit) => deposit.id === input.id)) {
    throw new LedgerError("unknown-entry");
  }
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });
  repository.save({
    ...snapshot,
    deposits: snapshot.deposits.map((deposit) =>
      deposit.id === input.id ? { ...deposit, date: input.date, amountCents: input.amountCents } : deposit,
    ),
  });
}

export function removeLotteryDeposit(repository: LotteryRepository, id: string): void {
  const snapshot = requireLottery(repository);
  const kept = snapshot.deposits.filter((deposit) => deposit.id !== id);
  if (kept.length === snapshot.deposits.length) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, deposits: kept });
}
