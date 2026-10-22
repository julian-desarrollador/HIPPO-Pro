import { LedgerError } from "../../domain/errors";
import type { LotteryExpense } from "../../domain/lottery";
import type { ExpenseKind } from "../../domain/types";
import { assertCents, assertIsoDate, assertYearMonth } from "../../domain/validation";
import { createId } from "../create-id";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";

export type RecordLotteryExpenseInput = {
  month: string;
  paidOn: string;
  kind: ExpenseKind;
  detail: string;
  amountCents: number;
};

export type UpdateLotteryExpenseInput = Omit<RecordLotteryExpenseInput, "month"> & { id: string };

function assertKind(kind: string): asserts kind is ExpenseKind {
  if (kind !== "agency" && kind !== "partner-withdrawal") {
    throw new LedgerError("unknown-category");
  }
}

export function recordLotteryExpense(repository: LotteryRepository, input: RecordLotteryExpenseInput): LotteryExpense {
  const snapshot = requireLottery(repository);
  assertYearMonth(input.month);
  assertIsoDate(input.paidOn);
  assertKind(input.kind);
  assertCents(input.amountCents, { allowZero: false });
  const expense: LotteryExpense = {
    id: createId("lottery-expense"),
    agencyId: snapshot.agencyId,
    month: input.month,
    paidOn: input.paidOn,
    detail: input.detail.trim(),
    amountCents: input.amountCents,
    kind: input.kind,
  };
  repository.save({ ...snapshot, expenses: [...snapshot.expenses, expense] });
  return expense;
}

export function updateLotteryExpense(repository: LotteryRepository, input: UpdateLotteryExpenseInput): void {
  const snapshot = requireLottery(repository);
  if (!snapshot.expenses.some((expense) => expense.id === input.id)) {
    throw new LedgerError("unknown-entry");
  }
  assertIsoDate(input.paidOn);
  assertKind(input.kind);
  assertCents(input.amountCents, { allowZero: false });
  repository.save({
    ...snapshot,
    expenses: snapshot.expenses.map((expense) =>
      expense.id === input.id
        ? { ...expense, paidOn: input.paidOn, kind: input.kind, detail: input.detail.trim(), amountCents: input.amountCents }
        : expense,
    ),
  });
}

export function removeLotteryExpense(repository: LotteryRepository, id: string): void {
  const snapshot = requireLottery(repository);
  const kept = snapshot.expenses.filter((expense) => expense.id !== id);
  if (kept.length === snapshot.expenses.length) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, expenses: kept });
}
