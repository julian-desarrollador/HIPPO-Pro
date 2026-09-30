import { LedgerError } from "../../domain/errors";
import { categoryHasExpenses, isBuiltinCategory, listExpenseCategories, type ExpenseCategory } from "../../domain/expense-categories";
import { racetrackIdFromName } from "../../domain/racetracks";
import type { AgencyExpenseCategory, CategoryLabel } from "../../domain/types";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddExpenseCategoryInput = {
  label: string;
};

function comparableLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function normalizedLabel(raw: string): string {
  const label = raw.trim().replace(/\s+/g, " ");
  if (!label || !racetrackIdFromName(label)) {
    throw new LedgerError("invalid-name");
  }
  return label;
}

export function addExpenseCategory(repository: LedgerRepository, input: AddExpenseCategoryInput): AgencyExpenseCategory {
  const snapshot = repository.load();
  const label = normalizedLabel(input.label);
  const id = racetrackIdFromName(label);

  const existing = listExpenseCategories(snapshot);
  const duplicate = existing.some(
    (category) => category.id === id || comparableLabel(category.label) === comparableLabel(label),
  );
  if (duplicate) {
    throw new LedgerError("duplicate-category");
  }

  const category: AgencyExpenseCategory = { id, label, kind: "agency" };
  repository.save({ ...snapshot, expenseCategories: [...(snapshot.expenseCategories ?? []), category] });
  return category;
}

export type UpdateExpenseCategoryInput = AddExpenseCategoryInput & { id: string };

function withLabel(labels: readonly CategoryLabel[] | undefined, id: string, label: string): CategoryLabel[] {
  const next = (labels ?? []).slice();
  const index = next.findIndex((item) => item.id === id);
  if (index === -1) {
    next.push({ id, label });
  } else {
    next[index] = { id, label };
  }
  return next;
}

export function updateExpenseCategory(repository: LedgerRepository, input: UpdateExpenseCategoryInput): ExpenseCategory {
  const snapshot = repository.load();
  const current = listExpenseCategories(snapshot).find((category) => category.id === input.id);
  if (!current) {
    throw new LedgerError("unknown-category");
  }

  const label = normalizedLabel(input.label);
  const duplicate = listExpenseCategories(snapshot).some(
    (category) => category.id !== input.id && comparableLabel(category.label) === comparableLabel(label),
  );
  if (duplicate) {
    throw new LedgerError("duplicate-category");
  }

  if (isBuiltinCategory(input.id)) {
    repository.save({ ...snapshot, categoryLabels: withLabel(snapshot.categoryLabels, input.id, label) });
    return { ...current, label };
  }

  const stored = snapshot.expenseCategories ?? [];
  const index = stored.findIndex((category) => category.id === input.id);
  if (index === -1) {
    throw new LedgerError("unknown-category");
  }
  const category: AgencyExpenseCategory = { id: input.id, label, kind: "agency" };
  const expenseCategories = stored.slice();
  expenseCategories[index] = category;
  repository.save({ ...snapshot, expenseCategories });
  return category;
}

export function removeExpenseCategory(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  if (!listExpenseCategories(snapshot).some((category) => category.id === id)) {
    throw new LedgerError("unknown-category");
  }
  if (categoryHasExpenses(snapshot, id)) {
    throw new LedgerError("category-in-use");
  }

  repository.save({
    ...snapshot,
    expenseCategories: (snapshot.expenseCategories ?? []).filter((category) => category.id !== id),
    categoryLabels: snapshot.categoryLabels?.filter((item) => item.id !== id),
    hiddenCategoryIds: isBuiltinCategory(id) ? [...(snapshot.hiddenCategoryIds ?? []), id] : snapshot.hiddenCategoryIds,
  });
}
