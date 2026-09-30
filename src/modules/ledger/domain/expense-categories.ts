import type { AgencyExpenseCategory, CategoryLabel, ExpenseKind, LedgerSnapshot } from "./types";
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
  return [...builtins, ...added];
}

export function isBuiltinCategory(id: string): boolean {
  return EXPENSE_CATEGORIES.some((category) => category.id === id);
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
