import { LedgerError } from "../../domain/errors";
import type { CashDay, CashExpense, CashIncome, CashIncomeKind } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";
import { findCashDay } from "./summarize-cash-day";

export type CashIncomeDraft = {
  id?: string;
  kind: CashIncomeKind;
  detail: string;
  amountCents: number;
};

export type CashExpenseDraft = {
  id?: string;
  detail: string;
  amountCents: number;
};

export type SaveCashDayInput = {
  date: string;
  actorName: string;
  at: string;
  openingCents: number;
  commissionCents: number;
  otherSalesCents: number;
  salesTaxCents: number;
  otherPaymentsCents: number;
  bankOutCents: number;
  personalWithdrawalCents: number;
  countedCents?: number | null;
  incomes: CashIncomeDraft[];
  expenses: CashExpenseDraft[];
};

const incomeKinds: readonly CashIncomeKind[] = ["bank", "partner", "other"];

function assertManual(value: number): void {
  assertCents(value, { allowZero: true });
}

function cleanDetail(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function reconcileIncome(previous: CashIncome | undefined, next: CashIncomeDraft, actorName: string, at: string): CashIncome {
  assertCents(next.amountCents, { allowZero: false });
  if (!incomeKinds.includes(next.kind)) {
    throw new LedgerError("invalid-amount");
  }
  const detail = cleanDetail(next.detail);
  if (!previous) {
    const name = actorName.trim();
    if (!name) {
      throw new LedgerError("invalid-name");
    }
    return {
      id: next.id ?? createId("cash-in"),
      kind: next.kind,
      detail,
      amountCents: next.amountCents,
      createdBy: name,
      createdAt: at,
    };
  }
  const changed = previous.kind !== next.kind || previous.detail !== detail || previous.amountCents !== next.amountCents;
  return {
    id: previous.id,
    kind: next.kind,
    detail,
    amountCents: next.amountCents,
    createdBy: previous.createdBy,
    createdAt: previous.createdAt,
    ...(changed
      ? { updatedBy: actorName.trim() || previous.updatedBy, updatedAt: at }
      : { updatedBy: previous.updatedBy, updatedAt: previous.updatedAt }),
  };
}

function reconcileExpense(previous: CashExpense | undefined, next: CashExpenseDraft): CashExpense {
  assertCents(next.amountCents, { allowZero: false });
  const detail = cleanDetail(next.detail);
  if (!detail) {
    throw new LedgerError("invalid-name");
  }
  return { id: previous?.id ?? next.id ?? createId("cash-out"), detail, amountCents: next.amountCents };
}

export function saveCashDay(repository: LedgerRepository, input: SaveCashDayInput): CashDay {
  assertIsoDate(input.date);
  assertManual(input.openingCents);
  assertManual(input.commissionCents);
  assertManual(input.otherSalesCents);
  assertManual(input.salesTaxCents);
  assertManual(input.otherPaymentsCents);
  assertManual(input.bankOutCents);
  assertManual(input.personalWithdrawalCents);
  if (input.countedCents !== undefined && input.countedCents !== null) {
    assertManual(input.countedCents);
  }

  const snapshot = repository.load();
  const existing = findCashDay(snapshot, input.date);
  const previousIncomes = new Map((existing?.incomes ?? []).map((income) => [income.id, income]));
  const previousExpenses = new Map((existing?.expenses ?? []).map((expense) => [expense.id, expense]));
  const day: CashDay = {
    id: existing?.id ?? createId("cash"),
    agencyId: snapshot.agencyId,
    date: input.date,
    openingCents: input.openingCents,
    commissionCents: input.commissionCents,
    otherSalesCents: input.otherSalesCents,
    salesTaxCents: input.salesTaxCents,
    otherPaymentsCents: input.otherPaymentsCents,
    bankOutCents: input.bankOutCents,
    personalWithdrawalCents: input.personalWithdrawalCents,
    ...(input.countedCents === undefined || input.countedCents === null ? {} : { countedCents: input.countedCents }),
    incomes: input.incomes.map((income) => reconcileIncome(income.id ? previousIncomes.get(income.id) : undefined, income, input.actorName, input.at)),
    expenses: input.expenses.map((expense) => reconcileExpense(expense.id ? previousExpenses.get(expense.id) : undefined, expense)),
  };
  const others = (snapshot.cashDays ?? []).filter((item) => item.id !== day.id);
  repository.save({ ...snapshot, cashDays: [...others, day] });
  return day;
}

export function removeCashDay(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const current = snapshot.cashDays ?? [];
  if (!current.some((day) => day.id === id && day.agencyId === snapshot.agencyId)) {
    throw new LedgerError("unknown-cash");
  }
  repository.save({ ...snapshot, cashDays: current.filter((day) => day.id !== id) });
}
