import { LedgerError } from "./errors";
import type { Cents } from "./money";

export function assertCents(value: Cents, options: { allowZero: boolean }): void {
  if (!Number.isInteger(value)) {
    throw new LedgerError("invalid-amount");
  }
  if (value < 0) {
    throw new LedgerError("negative-amount");
  }
  if (!options.allowZero && value === 0) {
    throw new LedgerError("empty-entry");
  }
}

export function assertCommissionBasisPoints(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new LedgerError("invalid-percent");
  }
}

export function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new LedgerError("invalid-date");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new LedgerError("invalid-date");
  }
}

export function assertYearMonth(month: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new LedgerError("invalid-date");
  }
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) {
    throw new LedgerError("invalid-date");
  }
}

export function assertDateInMonth(date: string, month: string): void {
  assertIsoDate(date);
  if (date.slice(0, 7) !== month) {
    throw new LedgerError("outside-month");
  }
}
