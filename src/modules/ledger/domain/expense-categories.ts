import type { AgencyExpenseCategory, CategoryLabel, ExpenseKind, LedgerSnapshot, ViewerRole } from "./types";
import { canViewPartnerWithdrawals } from "./access";
import { LedgerError } from "./errors";

export type ExpenseCategory = {
  id: string;
  label: string;
  kind: ExpenseKind;
};

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  { id: "sueldo", label: "Sueldo", kind: "agency" },
  { id: "aguinaldo", label: "Aguinaldo", kind: "agency" },
  { id: "cargas-sociales", label: "Cargas sociales", kind: "agency" },
  { id: "sindicato", label: "Aporte sindicato", kind: "agency" },
  { id: "alquiler", label: "Alquiler", kind: "agency" },
  { id: "internet", label: "Internet", kind: "agency" },
  { id: "luz", label: "Luz", kind: "agency" },
  { id: "contador", label: "Contador", kind: "agency" },
  { id: "administracion", label: "Administración", kind: "agency" },
  { id: "limpieza", label: "Limpieza", kind: "agency" },
  { id: "productos-limpieza", label: "Productos de limpieza", kind: "agency" },
  { id: "suplente", label: "Suplente", kind: "agency" },
  { id: "viaticos", label: "Viáticos", kind: "agency" },
  { id: "bidones", label: "Bidones", kind: "agency" },
  { id: "libreria", label: "Librería", kind: "agency" },
  { id: "toner", label: "Toner", kind: "agency" },
  { id: "remis", label: "Remis", kind: "agency" },
  { id: "deudas", label: "Deudas", kind: "agency" },
  { id: "error-caja", label: "Error de caja", kind: "agency" },
  { id: "bono-eficiencia", label: "Bono eficiencia", kind: "agency" },
  { id: "diarios", label: "Diarios y fotocopia", kind: "agency" },
  { id: "celular", label: "Celular", kind: "agency" },
  { id: "estufa", label: "Estufa", kind: "agency" },
  { id: "plomero", label: "Plomero", kind: "agency" },
  { id: "retiro-maquina", label: "Retiro de máquina", kind: "agency" },
  { id: "adelanto-fede", label: "Adelanto Fede", kind: "partner-withdrawal" },
  { id: "adelanto-mati", label: "Adelanto Mati", kind: "partner-withdrawal" },
  { id: "retiro-sag-fede", label: "Retiro SAG Fede", kind: "partner-withdrawal" },
  { id: "retiro-sag-mati", label: "Retiro SAG Mati", kind: "partner-withdrawal" },
];

/**
 * What the owner of any other agency uses to note what they take out. Dolores has its four
 * named ones, so these only appear in a book that hides all four: that is every agency
 * but Dolores, without a migration. The ids cannot collide with a category an owner added
 * by hand, because those ids come from the name alone.
 */
const OWNER_WITHDRAWAL_CATEGORIES: readonly ExpenseCategory[] = [
  { id: "adelanto-dueno", label: "Adelanto", kind: "partner-withdrawal" },
  { id: "retiro-dueno", label: "Retiro", kind: "partner-withdrawal" },
];

function comparableLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export type CategoryCatalog = {
  expenseCategories?: readonly AgencyExpenseCategory[];
  categoryLabels?: readonly CategoryLabel[];
  hiddenCategoryIds?: readonly string[];
};

function readCategoryCatalog(source?: CategoryCatalog | readonly AgencyExpenseCategory[]): {
  extras: readonly AgencyExpenseCategory[];
  labels: ReadonlyMap<string, string>;
  hidden: ReadonlySet<string>;
} {
  if (!source) {
    return { extras: [], labels: new Map(), hidden: new Set() };
  }
  if (Array.isArray(source)) {
    return { extras: source, labels: new Map(), hidden: new Set() };
  }
  const catalog = source as CategoryCatalog;
  return {
    extras: catalog.expenseCategories ?? [],
    labels: new Map((catalog.categoryLabels ?? []).map((item) => [item.id, item.label])),
    hidden: new Set(catalog.hiddenCategoryIds ?? []),
  };
}

export function listExpenseCategories(source?: CategoryCatalog | readonly AgencyExpenseCategory[]): readonly ExpenseCategory[] {
  const { extras, labels, hidden } = readCategoryCatalog(source);
  const builtins = EXPENSE_CATEGORIES.filter((category) => !hidden.has(category.id)).map((category) => ({
    ...category,
    label: labels.get(category.id) ?? category.label,
  }));
  const added = extras.filter((category) => !isBuiltinCategory(category.id) && !hidden.has(category.id));
  const namedOnesHidden = EXPENSE_CATEGORIES.filter((category) => category.kind === "partner-withdrawal").every((category) =>
    hidden.has(category.id),
  );
  // An owner who already made their own "Retiro" keeps it, with no second one next to it.
  const ownerWithdrawals = namedOnesHidden
    ? OWNER_WITHDRAWAL_CATEGORIES.filter(
        (category) =>
          !hidden.has(category.id) && !added.some((other) => comparableLabel(other.label) === comparableLabel(category.label)),
      ).map((category) => ({ ...category, label: labels.get(category.id) ?? category.label }))
    : [];
  return [...builtins, ...ownerWithdrawals, ...added];
}

/**
 * Every category the book knows, also the ones taken off the list. An expense keeps
 * its category when that category is removed: this is where its name comes from.
 */
export function knownExpenseCategories(source?: CategoryCatalog | readonly AgencyExpenseCategory[]): readonly ExpenseCategory[] {
  const { extras, labels } = readCategoryCatalog(source);
  const builtins = [...EXPENSE_CATEGORIES, ...OWNER_WITHDRAWAL_CATEGORIES].map((category) => ({
    ...category,
    label: labels.get(category.id) ?? category.label,
  }));
  return [...builtins, ...extras.filter((category) => !isBuiltinCategory(category.id))];
}

export function expenseCategoryLabel(id: string, source?: CategoryCatalog | readonly AgencyExpenseCategory[]): string {
  return knownExpenseCategories(source).find((category) => category.id === id)?.label ?? id;
}

/** A category taken off the list, with this id or this name. Adding it again brings this one back. */
export function findRemovedCategory(
  source: CategoryCatalog,
  id: string,
  label: string,
): ExpenseCategory | undefined {
  const { hidden } = readCategoryCatalog(source);
  return knownExpenseCategories(source).find(
    (category) => hidden.has(category.id) && (category.id === id || comparableLabel(category.label) === comparableLabel(label)),
  );
}

export function isBuiltinCategory(id: string): boolean {
  return EXPENSE_CATEGORIES.some((category) => category.id === id) || OWNER_WITHDRAWAL_CATEGORIES.some((category) => category.id === id);
}

export function categoryHasExpenses(snapshot: Pick<LedgerSnapshot, "expenses">, id: string): boolean {
  return snapshot.expenses.some((expense) => expense.categoryId === id);
}

export function getExpenseCategory(id: string, source?: CategoryCatalog | readonly AgencyExpenseCategory[]): ExpenseCategory {
  const found = listExpenseCategories(source).find((category) => category.id === id);
  if (!found) {
    throw new LedgerError("unknown-category");
  }
  return found;
}

/** For editing an expense whose category is no longer on the list. New expenses use getExpenseCategory. */
export function getKnownExpenseCategory(id: string, source?: CategoryCatalog | readonly AgencyExpenseCategory[]): ExpenseCategory {
  const found = knownExpenseCategories(source).find((category) => category.id === id);
  if (!found) {
    throw new LedgerError("unknown-category");
  }
  return found;
}

/** Advances, withdrawals and owner-only categories are not listed in Gastos: they appear in Resultado. */
export function categoryGoesToResult(categories: readonly ExpenseCategory[], categoryId: string): boolean {
  return categories.find((category) => category.id === categoryId)?.kind === "partner-withdrawal";
}

/** The operator only sees agency categories. Owner advances and withdrawals stay hidden. */
export function expenseCategoriesFor(role: ViewerRole, categories: readonly ExpenseCategory[]): readonly ExpenseCategory[] {
  return canViewPartnerWithdrawals(role) ? categories : categories.filter((category) => category.kind === "agency");
}
