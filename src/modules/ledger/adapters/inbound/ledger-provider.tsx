import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { canViewAgencyBalances } from "../../domain/access";
import type { ViewerRole } from "../../domain/types";
import { buildMonthReport } from "../../application/use-cases/build-month-report";
import { recordDay as saveDay, type RecordDayInput } from "../../application/use-cases/record-day";
import {
  recordDeposit as saveDeposit,
  type RecordDepositInput,
} from "../../application/use-cases/record-deposit";
import {
  recordExpense as saveExpense,
  type RecordExpenseInput,
} from "../../application/use-cases/record-expense";
import { removeDay as deleteDay, removeDeposit as deleteDeposit, removeExpense as deleteExpense } from "../../application/use-cases/remove-entry";
import { updateCommission as saveCommission } from "../../application/use-cases/update-commission";
import { updateDay as saveUpdatedDay, type UpdateDayInput } from "../../application/use-cases/update-day";
import { updateDeposit as saveUpdatedDeposit, type UpdateDepositInput } from "../../application/use-cases/update-deposit";
import { updateExpense as saveUpdatedExpense, type UpdateExpenseInput } from "../../application/use-cases/update-expense";
import { listSettledDays, summarizeMonth, type MonthSummary, type SettledDay } from "../../application/use-cases/summarize-month";
import { ledgerSync } from "../outbound/agency-ledger";
import { createInMemoryLedgerRepository } from "../outbound/in-memory-ledger-repository";
import { createLocalStorageLedgerRepository } from "../outbound/local-storage-ledger-repository";
import type { LedgerRepository } from "../../application/ports/ledger-repository";
import type { LedgerSnapshot } from "../../domain/types";

type LedgerContextValue = {
  role: ViewerRole;
  setRole: (role: ViewerRole) => void;
  persistence: "browser" | "agency";
  signOut: (() => void) | null;
  canViewBalances: boolean;
  viewMonth: string;
  setViewMonth: (month: string) => void;
  snapshot: LedgerSnapshot;
  summary: MonthSummary;
  days: SettledDay[];
  reportText: string;
  recordDay: (input: RecordDayInput) => Promise<void>;
  recordDeposit: (input: RecordDepositInput) => Promise<void>;
  recordExpense: (input: RecordExpenseInput) => Promise<void>;
  updateDay: (input: UpdateDayInput) => Promise<void>;
  updateCommission: (racetrackId: string, commissionBasisPoints: number) => Promise<void>;
  updateDeposit: (input: UpdateDepositInput) => Promise<void>;
  updateExpense: (input: UpdateExpenseInput) => Promise<void>;
  removeDay: (id: string) => Promise<void>;
  removeDeposit: (id: string) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  reset: () => Promise<void>;
};

function createAppLedgerRepository(): LedgerRepository {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return createInMemoryLedgerRepository();
    }
    return createLocalStorageLedgerRepository(storage);
  } catch {
    return createInMemoryLedgerRepository();
  }
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({
  children,
  repository: externalRepository,
  role: lockedRole,
  persistence = "browser",
  signOut = null,
}: {
  children: ReactNode;
  repository?: LedgerRepository;
  role?: ViewerRole;
  persistence?: "browser" | "agency";
  signOut?: (() => void) | null;
}) {
  const fallback = useRef<LedgerRepository | null>(null);
  if (!externalRepository && fallback.current === null) {
    fallback.current = createAppLedgerRepository();
  }
  const repository = externalRepository ?? fallback.current!;
  const [version, setVersion] = useState(0);
  const [previewRole, setPreviewRole] = useState<ViewerRole>("owner");
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const role = lockedRole ?? previewRole;

  const value = useMemo<LedgerContextValue>(() => {
    const snapshot = repository.load();
    const viewMonth = chosenMonth ?? snapshot.month;
    const summary = summarizeMonth(snapshot, viewMonth);

    function publish(action: () => void): Promise<void> {
      return (async () => {
        action();
        try {
          await ledgerSync(repository);
        } catch (error) {
          setVersion((current) => current + 1);
          throw error;
        }
        setVersion((current) => current + 1);
      })();
    }

    return {
      role,
      setRole: (next) => {
        if (!lockedRole) {
          setPreviewRole(next);
        }
      },
      persistence,
      signOut,
      canViewBalances: canViewAgencyBalances(role),
      viewMonth,
      setViewMonth: setChosenMonth,
      snapshot,
      summary,
      days: listSettledDays(snapshot, viewMonth),
      reportText: buildMonthReport(summary),
      recordDay: (input) => publish(() => saveDay(repository, input)),
      recordDeposit: (input) => publish(() => saveDeposit(repository, input)),
      recordExpense: (input) => publish(() => saveExpense(repository, input)),
      updateDay: (input) => publish(() => saveUpdatedDay(repository, input)),
      updateCommission: (racetrackId, commissionBasisPoints) =>
        publish(() => saveCommission(repository, { racetrackId, commissionBasisPoints })),
      updateDeposit: (input) => publish(() => saveUpdatedDeposit(repository, input)),
      updateExpense: (input) => publish(() => saveUpdatedExpense(repository, input)),
      removeDay: (id) => publish(() => deleteDay(repository, id)),
      removeDeposit: (id) => publish(() => deleteDeposit(repository, id)),
      removeExpense: (id) => publish(() => deleteExpense(repository, id)),
      reset: () => publish(() => repository.reset()),
    };
  }, [chosenMonth, lockedRole, persistence, repository, role, signOut, version]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) {
    throw new Error("useLedger debe usarse dentro de LedgerProvider");
  }
  return value;
}
