import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { canViewAgencyBalances } from "../../domain/access";
import { listExpenseCategories, type ExpenseCategory } from "../../domain/expense-categories";
import { listRacetracks, type RacetrackRule } from "../../domain/racetracks";
import type { DailySale, ViewerRole } from "../../domain/types";
import { buildMonthReport } from "../../application/use-cases/build-month-report";
import {
  addBettor as saveBettor,
  removeBettor as deleteBettor,
  updateBettor as saveUpdatedBettor,
  type AddBettorInput,
  type UpdateBettorInput,
} from "../../application/use-cases/manage-bettors";
import {
  addExpenseCategory as saveExpenseCategory,
  removeExpenseCategory as deleteExpenseCategory,
  updateExpenseCategory as saveUpdatedExpenseCategory,
  type AddExpenseCategoryInput,
  type UpdateExpenseCategoryInput,
} from "../../application/use-cases/manage-expense-categories";
import { addRacetrack as saveRacetrack, removeRacetrack as deleteRacetrack, updateRacetrack as saveUpdatedRacetrack, type AddRacetrackInput, type UpdateRacetrackInput } from "../../application/use-cases/manage-racetracks";
import {
  recordBettorPayment as saveBettorPayment,
  recordBettorPlay as saveBettorPlay,
  updateBettorPayment as saveUpdatedBettorPayment,
  updateBettorPlay as saveUpdatedBettorPlay,
  type RecordBettorPaymentInput,
  type RecordBettorPlayInput,
  type UpdateBettorPaymentInput,
  type UpdateBettorPlayInput,
} from "../../application/use-cases/mutate-bettor-ledger";
import { recordDay as saveDay, type RecordDayInput } from "../../application/use-cases/record-day";
import {
  recordDeposit as saveDeposit,
  type RecordDepositInput,
} from "../../application/use-cases/record-deposit";
import {
  recordExpense as saveExpense,
  type RecordExpenseInput,
} from "../../application/use-cases/record-expense";
import { removeBettorPayment as deleteBettorPayment, removeBettorPlay as deleteBettorPlay, removeDay as deleteDay, removeDeposit as deleteDeposit, removeExpense as deleteExpense } from "../../application/use-cases/remove-entry";
import { updateDay as saveUpdatedDay, type UpdateDayInput } from "../../application/use-cases/update-day";
import { updateDeposit as saveUpdatedDeposit, type UpdateDepositInput } from "../../application/use-cases/update-deposit";
import { updateExpense as saveUpdatedExpense, type UpdateExpenseInput } from "../../application/use-cases/update-expense";
import { listBettorAccounts, type BettorAccount } from "../../application/use-cases/summarize-bettors";
import { listSettledDays, summarizeMonth, type MonthSummary, type SettledDay } from "../../application/use-cases/summarize-month";
import { withAuditEntry, withRestoreAudit } from "../../application/use-cases/describe-ledger-change";
import { ledgerSync } from "../outbound/agency-ledger";
import { PREVIEW_AGENCY_NAME } from "../outbound/august-2026-seed";
import { createInMemoryLedgerRepository } from "../outbound/in-memory-ledger-repository";
import { createLocalStorageLedgerRepository } from "../outbound/local-storage-ledger-repository";
import type { LedgerRepository } from "../../application/ports/ledger-repository";
import type { LedgerSnapshot } from "../../domain/types";

type LedgerContextValue = {
  role: ViewerRole;
  displayName: string;
  agencyName: string;
  userId: string;
  canInviteOwners: boolean;
  canCreateAgencies: boolean;
  setRole: (role: ViewerRole) => void;
  persistence: "browser" | "agency";
  signOut: (() => void) | null;
  canViewBalances: boolean;
  viewMonth: string;
  setViewMonth: (month: string) => void;
  snapshot: LedgerSnapshot;
  racetracks: readonly RacetrackRule[];
  expenseCategories: readonly ExpenseCategory[];
  bettorAccounts: readonly BettorAccount[];
  summary: MonthSummary;
  days: SettledDay[];
  reportText: string;
  recordDay: (input: RecordDayInput) => Promise<DailySale>;
  recordDeposit: (input: RecordDepositInput) => Promise<void>;
  recordExpense: (input: RecordExpenseInput) => Promise<void>;
  updateDay: (input: UpdateDayInput) => Promise<void>;
  updateDeposit: (input: UpdateDepositInput) => Promise<void>;
  updateExpense: (input: UpdateExpenseInput) => Promise<void>;
  removeDay: (id: string) => Promise<void>;
  removeDeposit: (id: string) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  addRacetrack: (input: AddRacetrackInput) => Promise<void>;
  updateRacetrack: (input: UpdateRacetrackInput) => Promise<void>;
  removeRacetrack: (id: string) => Promise<void>;
  addExpenseCategory: (input: AddExpenseCategoryInput) => Promise<void>;
  updateExpenseCategory: (input: UpdateExpenseCategoryInput) => Promise<void>;
  removeExpenseCategory: (id: string) => Promise<void>;
  addBettor: (input: AddBettorInput) => Promise<void>;
  updateBettor: (input: UpdateBettorInput) => Promise<void>;
  removeBettor: (id: string) => Promise<void>;
  recordBettorPlay: (input: RecordBettorPlayInput) => Promise<void>;
  updateBettorPlay: (input: UpdateBettorPlayInput) => Promise<void>;
  removeBettorPlay: (id: string) => Promise<void>;
  recordBettorPayment: (input: RecordBettorPaymentInput) => Promise<void>;
  updateBettorPayment: (input: UpdateBettorPaymentInput) => Promise<void>;
  removeBettorPayment: (id: string) => Promise<void>;
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

/** Month shown on entry: the device's local month, not the seed month. */
function currentYearMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function LedgerProvider({
  children,
  repository: externalRepository,
  role: lockedRole,
  displayName = "",
  agencyName = PREVIEW_AGENCY_NAME,
  userId = "",
  canInviteOwners = false,
  canCreateAgencies = false,
  persistence = "browser",
  signOut = null,
}: {
  children: ReactNode;
  repository?: LedgerRepository;
  role?: ViewerRole;
  displayName?: string;
  agencyName?: string;
  userId?: string;
  canInviteOwners?: boolean;
  canCreateAgencies?: boolean;
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
  const [chosenMonth, setChosenMonth] = useState<string | null>(currentYearMonth);
  const role = lockedRole ?? previewRole;

  const value = useMemo<LedgerContextValue>(() => {
    const snapshot = repository.load();
    const viewMonth = chosenMonth ?? snapshot.month;
    const summary = summarizeMonth(snapshot, viewMonth);

    function publish(action: () => void, restore = false): Promise<void> {
      return (async () => {
        const before = repository.load();
        action();
        const after = repository.load();
        const at = new Date().toISOString();
        const next = restore ? withRestoreAudit(after, role, at) : withAuditEntry(before, after, role, at);
        if (next !== after) {
          repository.save(next);
        }
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
      displayName,
      agencyName,
      userId,
      canInviteOwners,
      canCreateAgencies,
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
      racetracks: listRacetracks(snapshot),
      expenseCategories: listExpenseCategories(snapshot),
      bettorAccounts: listBettorAccounts(snapshot),
      summary,
      days: listSettledDays(snapshot, viewMonth),
      reportText: buildMonthReport(summary, agencyName),
      recordDay: async (input) => {
        let created: DailySale | null = null;
        await publish(() => {
          created = saveDay(repository, input);
        });
        if (!created) {
          throw new Error("El día no quedó guardado.");
        }
        return created;
      },
      recordDeposit: (input) => publish(() => saveDeposit(repository, input)),
      recordExpense: (input) => publish(() => saveExpense(repository, input)),
      updateDay: (input) => publish(() => saveUpdatedDay(repository, input)),
      updateDeposit: (input) => publish(() => saveUpdatedDeposit(repository, input)),
      updateExpense: (input) => publish(() => saveUpdatedExpense(repository, input)),
      removeDay: (id) => publish(() => deleteDay(repository, id)),
      removeDeposit: (id) => publish(() => deleteDeposit(repository, id)),
      removeExpense: (id) => publish(() => deleteExpense(repository, id)),
      addRacetrack: (input) => publish(() => saveRacetrack(repository, input)),
      updateRacetrack: (input) => publish(() => saveUpdatedRacetrack(repository, input)),
      removeRacetrack: (id) => publish(() => deleteRacetrack(repository, id)),
      addExpenseCategory: (input) => publish(() => saveExpenseCategory(repository, input)),
      updateExpenseCategory: (input) => publish(() => saveUpdatedExpenseCategory(repository, input)),
      removeExpenseCategory: (id) => publish(() => deleteExpenseCategory(repository, id)),
      addBettor: (input) => publish(() => saveBettor(repository, input)),
      updateBettor: (input) => publish(() => saveUpdatedBettor(repository, input)),
      removeBettor: (id) => publish(() => deleteBettor(repository, id)),
      recordBettorPlay: (input) => publish(() => saveBettorPlay(repository, input)),
      updateBettorPlay: (input) => publish(() => saveUpdatedBettorPlay(repository, input)),
      removeBettorPlay: (id) => publish(() => deleteBettorPlay(repository, id)),
      recordBettorPayment: (input) => publish(() => saveBettorPayment(repository, input)),
      updateBettorPayment: (input) => publish(() => saveUpdatedBettorPayment(repository, input)),
      removeBettorPayment: (id) => publish(() => deleteBettorPayment(repository, id)),
      reset: () => publish(() => repository.reset(), true),
    };
  }, [agencyName, canCreateAgencies, canInviteOwners, chosenMonth, displayName, lockedRole, persistence, repository, role, signOut, userId, version]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const value = useContext(LedgerContext);
  if (!value) {
    throw new Error("useLedger debe usarse dentro de LedgerProvider");
  }
  return value;
}
