import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { seesLottery } from "../../domain/features";
import type { LotteryGame, LotterySnapshot } from "../../domain/lottery";
import type { LotteryRepository } from "../../application/ports/lottery-repository";
import { activateLottery } from "../../application/use-cases/lottery-activate";
import { withLotteryAudit } from "../../application/use-cases/lottery-audit";
import {
  recordLotteryDeposit,
  removeLotteryDeposit,
  updateLotteryDeposit,
  type RecordLotteryDepositInput,
  type UpdateLotteryDepositInput,
} from "../../application/use-cases/lottery-deposits";
import {
  recordLotteryExpense,
  removeLotteryExpense,
  updateLotteryExpense,
  type RecordLotteryExpenseInput,
  type UpdateLotteryExpenseInput,
} from "../../application/use-cases/lottery-expenses";
import { updateLotteryCommission, type UpdateLotteryCommissionInput } from "../../application/use-cases/lottery-games";
import {
  previewLotteryDay,
  recordLotteryDay,
  removeLotteryDay,
  updateLotteryDay,
  type LotteryAmount,
  type LotteryDayKey,
  type LotteryDayPreview,
  type RecordLotteryDayInput,
  type UpdateLotteryDayInput,
} from "../../application/use-cases/lottery-sales";
import {
  combineAgencyMonth,
  listLotteryDays,
  summarizeLotteryMonth,
  type AgencyMonth,
  type LotteryDayRow,
  type LotteryMonthSummary,
} from "../../application/use-cases/lottery-summary";
import { lotterySync } from "../outbound/lottery-ledger";
import { useLedger } from "./ledger-provider";

export type LotteryStatus = "unavailable" | "loading" | "error" | "inactive" | "active";

export type OpenLottery = (agencyId: string) => Promise<LotteryRepository>;

type LotteryContextValue = {
  status: LotteryStatus;
  snapshot: LotterySnapshot | null;
  games: readonly LotteryGame[];
  summary: LotteryMonthSummary | null;
  agencyMonth: AgencyMonth | null;
  days: LotteryDayRow[];
  retry: () => void;
  previewDay: (amounts: readonly LotteryAmount[], editing?: LotteryDayKey) => LotteryDayPreview | null;
  activate: () => Promise<void>;
  recordDay: (input: RecordLotteryDayInput) => Promise<void>;
  updateDay: (input: UpdateLotteryDayInput) => Promise<void>;
  removeDay: (key: LotteryDayKey) => Promise<void>;
  recordDeposit: (input: RecordLotteryDepositInput) => Promise<void>;
  updateDeposit: (input: UpdateLotteryDepositInput) => Promise<void>;
  removeDeposit: (id: string) => Promise<void>;
  recordExpense: (input: RecordLotteryExpenseInput) => Promise<void>;
  updateExpense: (input: UpdateLotteryExpenseInput) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  updateCommission: (input: UpdateLotteryCommissionInput) => Promise<void>;
};

const unavailable = (): Promise<void> => Promise.reject(new Error("La quiniela no está disponible."));

const UNAVAILABLE: LotteryContextValue = {
  status: "unavailable",
  snapshot: null,
  games: [],
  summary: null,
  agencyMonth: null,
  days: [],
  retry: () => {},
  previewDay: () => null,
  activate: unavailable,
  recordDay: unavailable,
  updateDay: unavailable,
  removeDay: unavailable,
  recordDeposit: unavailable,
  updateDeposit: unavailable,
  removeDeposit: unavailable,
  recordExpense: unavailable,
  updateExpense: unavailable,
  removeExpense: unavailable,
  updateCommission: unavailable,
};

const LotteryContext = createContext<LotteryContextValue>(UNAVAILABLE);

function currentYearMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type Opened = { key: string } & ({ status: "error" } | { status: "open"; repository: LotteryRepository });

/**
 * Lives inside LedgerProvider and only reads from it. The lottery book is a
 * separate repository: nothing here saves the racing book.
 */
export function LotteryProvider({ open, children }: { open: OpenLottery | null; children: ReactNode }) {
  const ledger = useLedger();
  const agencyId = ledger.snapshot.agencyId;
  const available = open !== null && seesLottery(ledger.agencyMode) && !ledger.readOnly;
  const [opened, setOpened] = useState<Opened | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [version, setVersion] = useState(0);
  const openKey = `${agencyId}|${attempt}`;
  const current = opened?.key === openKey ? opened : null;

  useEffect(() => {
    if (!available || !open) {
      return;
    }
    let alive = true;
    open(agencyId)
      .then((repository) => {
        if (alive) {
          setOpened({ key: openKey, status: "open", repository });
        }
      })
      .catch(() => {
        if (alive) {
          setOpened({ key: openKey, status: "error" });
        }
      });
    return () => {
      alive = false;
    };
  }, [agencyId, available, open, openKey]);

  const { role, displayName, viewMonth, summary: racingSummary } = ledger;

  const value = useMemo<LotteryContextValue>(() => {
    if (!available) {
      return UNAVAILABLE;
    }
    const retry = () => setAttempt((current) => current + 1);
    if (!current || current.status !== "open") {
      return { ...UNAVAILABLE, status: current ? "error" : "loading", retry };
    }
    const repository = current.repository;
    const snapshot = repository.load();
    const summary = snapshot ? summarizeLotteryMonth(snapshot, viewMonth) : null;

    async function settle(): Promise<void> {
      try {
        await lotterySync(repository);
      } finally {
        setVersion((current) => current + 1);
      }
    }

    function publish(action: () => void): Promise<void> {
      return (async () => {
        const before = repository.load();
        action();
        const after = repository.load();
        if (before && after) {
          const next = withLotteryAudit(before, after, role, new Date().toISOString(), displayName);
          if (next !== after) {
            repository.save(next);
          }
        }
        await settle();
      })();
    }

    function run(action: () => unknown): Promise<void> {
      return publish(() => {
        action();
      });
    }

    return {
      status: snapshot ? "active" : "inactive",
      snapshot,
      games: snapshot?.games ?? [],
      summary,
      agencyMonth: summary ? combineAgencyMonth(racingSummary, summary) : null,
      days: snapshot ? listLotteryDays(snapshot, viewMonth) : [],
      retry,
      previewDay: (amounts, editing) => (snapshot ? previewLotteryDay(snapshot, amounts, editing) : null),
      activate: async () => {
        activateLottery(repository, {
          agencyId,
          role,
          actorName: displayName,
          at: new Date().toISOString(),
          month: currentYearMonth(),
        });
        await settle();
      },
      recordDay: (input) => run(() => recordLotteryDay(repository, input)),
      updateDay: (input) => run(() => updateLotteryDay(repository, input)),
      removeDay: (key) => run(() => removeLotteryDay(repository, key)),
      recordDeposit: (input) => run(() => recordLotteryDeposit(repository, input)),
      updateDeposit: (input) => run(() => updateLotteryDeposit(repository, input)),
      removeDeposit: (id) => run(() => removeLotteryDeposit(repository, id)),
      recordExpense: (input) => run(() => recordLotteryExpense(repository, input)),
      updateExpense: (input) => run(() => updateLotteryExpense(repository, input)),
      removeExpense: (id) => run(() => removeLotteryExpense(repository, id)),
      updateCommission: (input) => run(() => updateLotteryCommission(repository, input)),
    };
  }, [agencyId, available, current, displayName, racingSummary, role, version, viewMonth]);

  return <LotteryContext.Provider value={value}>{children}</LotteryContext.Provider>;
}

export function useLottery(): LotteryContextValue {
  return useContext(LotteryContext);
}
