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

export function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new LedgerError("invalid-date");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new LedgerError("invalid-date");
  }
}

export function assertDateInMonth(date: string, month: string): void {
  assertIsoDate(date);
  if (date.slice(0, 7) !== month) {
    throw new LedgerError("outside-month");
  }
}
