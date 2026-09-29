import { LedgerError } from "../../domain/errors";
import type { LedgerRepository } from "../ports/ledger-repository";

export function removeDay(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const exists = snapshot.days.some((day) => day.id === id && day.agencyId === snapshot.agencyId);
  if (!exists) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, days: snapshot.days.filter((day) => day.id !== id) });
}

export function removeDeposit(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const exists = snapshot.deposits.some((deposit) => deposit.id === id && deposit.agencyId === snapshot.agencyId);
  if (!exists) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, deposits: snapshot.deposits.filter((deposit) => deposit.id !== id) });
}

export function removeExpense(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const exists = snapshot.expenses.some((expense) => expense.id === id && expense.agencyId === snapshot.agencyId);
  if (!exists) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, expenses: snapshot.expenses.filter((expense) => expense.id !== id) });
}
