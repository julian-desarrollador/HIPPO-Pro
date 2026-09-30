import { getExpenseCategory } from "../../domain/expense-categories";
import type { Expense } from "../../domain/types";
import { assertCents, assertIsoDate, assertYearMonth } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type RecordExpenseInput = {
  paidOn: string;
  categoryId: string;
  detail: string;
  amountCents: number;
  month?: string;
};

export function recordExpense(repository: LedgerRepository, input: RecordExpenseInput): Expense {
  const snapshot = repository.load();
  assertIsoDate(input.paidOn);
  const month = input.month ?? snapshot.month;
  assertYearMonth(month);
  const category = getExpenseCategory(input.categoryId, snapshot);
  assertCents(input.amountCents, { allowZero: false });

  const expense: Expense = {
    id: createId("expense"),
    agencyId: snapshot.agencyId,
    month,
    paidOn: input.paidOn,
    categoryId: category.id,
    detail: input.detail.trim(),
    amountCents: input.amountCents,
    kind: category.kind,
  };

  repository.save({ ...snapshot, expenses: [...snapshot.expenses, expense] });
  return expense;
}
