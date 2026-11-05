import { LedgerError } from "../../domain/errors";
import { categoryHasExpenses, findRemovedCategory, isBuiltinCategory, listExpenseCategories, type ExpenseCategory } from "../../domain/expense-categories";
import { racetrackIdFromName } from "../../domain/racetracks";
import type { AgencyExpenseCategory, CategoryLabel, ExpenseKind } from "../../domain/types";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddExpenseCategoryInput = {
  label: string;
  /** agency (the default) is public. partner-withdrawal is owner only and is listed in Resultado. */
  kind?: ExpenseKind;
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

export function addExpenseCategory(repository: LedgerRepository, input: AddExpenseCategoryInput): ExpenseCategory {
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

  // Same name as one taken off the list: it comes back with its kind, so its expenses stay in the same table.
  const removed = findRemovedCategory(snapshot, id, label);
  if (removed) {
    repository.save({
      ...snapshot,
      hiddenCategoryIds: (snapshot.hiddenCategoryIds ?? []).filter((hiddenId) => hiddenId !== removed.id),
    });
    return removed;
  }

  const category: AgencyExpenseCategory = { id, label, kind: input.kind ?? "agency" };
  repository.save({ ...snapshot, expenseCategories: [...(snapshot.expenseCategories ?? []), category] });
  return category;
}

export type UpdateExpenseCategoryInput = Pick<AddExpenseCategoryInput, "label"> & { id: string };

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
  // Renaming never changes the kind: its expenses stay in the same table.
  const category: AgencyExpenseCategory = { id: input.id, label, kind: current.kind };
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

  // With expenses it only leaves the list: they keep its name and keep adding up.
  if (categoryHasExpenses(snapshot, id)) {
    repository.save({ ...snapshot, hiddenCategoryIds: [...(snapshot.hiddenCategoryIds ?? []), id] });
    return;
  }

  repository.save({
    ...snapshot,
    expenseCategories: (snapshot.expenseCategories ?? []).filter((category) => category.id !== id),
    categoryLabels: snapshot.categoryLabels?.filter((item) => item.id !== id),
    hiddenCategoryIds: isBuiltinCategory(id) ? [...(snapshot.hiddenCategoryIds ?? []), id] : snapshot.hiddenCategoryIds,
  });
}
