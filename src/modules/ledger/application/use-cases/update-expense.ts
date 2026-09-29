import { LedgerError } from "../../domain/errors";
import { getExpenseCategory } from "../../domain/expense-categories";
import type { Expense } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import type { RecordExpenseInput } from "./record-expense";

export type UpdateExpenseInput = RecordExpenseInput & { id: string };

export function updateExpense(repository: LedgerRepository, input: UpdateExpenseInput): Expense {
  const snapshot = repository.load();
  const index = snapshot.expenses.findIndex(
    (expense) => expense.id === input.id && expense.agencyId === snapshot.agencyId,
  );
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  assertIsoDate(input.paidOn);
  const category = getExpenseCategory(input.categoryId);
  assertCents(input.amountCents, { allowZero: false });

  const current = snapshot.expenses[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }
  const updated: Expense = {
    ...current,
    paidOn: input.paidOn,
    categoryId: category.id,
    detail: input.detail.trim(),
    amountCents: input.amountCents,
    kind: category.kind,
  };
  const expenses = snapshot.expenses.slice();
  expenses[index] = updated;
  repository.save({ ...snapshot, expenses });
  return updated;
}
