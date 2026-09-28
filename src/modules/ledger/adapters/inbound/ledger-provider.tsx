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
import { listSettledDays, summarizeMonth, type MonthSummary, type SettledDay } from "../../application/use-cases/summarize-month";
import { createInMemoryLedgerRepository } from "../outbound/in-memory-ledger-repository";
import type { LedgerRepository } from "../../application/ports/ledger-repository";
import type { LedgerSnapshot } from "../../domain/types";

type LedgerContextValue = {
  role: ViewerRole;
  setRole: (role: ViewerRole) => void;
  canViewBalances: boolean;
  snapshot: LedgerSnapshot;
  summary: MonthSummary;
  days: SettledDay[];
  reportText: string;
  recordDay: (input: RecordDayInput) => void;
  recordDeposit: (input: RecordDepositInput) => void;
  recordExpense: (input: RecordExpenseInput) => void;
  reset: () => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const repository = useRef<LedgerRepository>(createInMemoryLedgerRepository());
  const [version, setVersion] = useState(0);
  const [role, setRole] = useState<ViewerRole>("owner");

  const value = useMemo<LedgerContextValue>(() => {
    const snapshot = repository.current.load();
    const summary = summarizeMonth(snapshot);

    return {
      role,
      setRole,
      canViewBalances: canViewAgencyBalances(role),
      snapshot,
      summary,
      days: listSettledDays(snapshot),
      reportText: buildMonthReport(summary),
      recordDay: (input) => {
        saveDay(repository.current, input);
        setVersion((current) => current + 1);
      },
      recordDeposit: (input) => {
        saveDeposit(repository.current, input);
        setVersion((current) => current + 1);
      },
      recordExpense: (input) => {
        saveExpense(repository.current, input);
        setVersion((current) => current + 1);
      },
      reset: () => {
        repository.current.reset();
        setVersion((current) => current + 1);
      },
    };
  }, [role, version]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) {
    throw new Error("useLedger debe usarse dentro de LedgerProvider");
  }
  return value;
}
