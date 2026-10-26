import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { seesLottery } from "../../domain/features";
import { LedgerError } from "../../domain/errors";
import { listedLotteryGames, withTicketGames, type LotteryGame, type LotterySnapshot } from "../../domain/lottery";
import type { LotteryRepository } from "../../application/ports/lottery-repository";
import { summarizeAgencyAccount, type AgencyAccount } from "../../application/use-cases/agency-account";
import {
  applyLotteryPlan,
  applyRacingPlan,
  listAgencyDays,
  planAgencyDay,
  previewAgencyDay,
  type AgencyDayPreview,
  type AgencyDayRow,
  type AgencyTrackAmount,
  type RecordAgencyDayInput,
} from "../../application/use-cases/agency-day";
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
import { removeDay } from "../../application/use-cases/remove-entry";
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
import { useLedger, useRacingCommit } from "./ledger-provider";

export type LotteryStatus = "unavailable" | "loading" | "error" | "inactive" | "active";

export type OpenLottery = (agencyId: string) => Promise<LotteryRepository>;

type LotteryContextValue = {
  status: LotteryStatus;
  snapshot: LotterySnapshot | null;
  games: readonly LotteryGame[];
  summary: LotteryMonthSummary | null;
  account: AgencyAccount | null;
  agencyMonth: AgencyMonth | null;
  days: LotteryDayRow[];
  agencyDays: AgencyDayRow[];
  retry: () => void;
  previewDay: (amounts: readonly LotteryAmount[], editing?: LotteryDayKey) => LotteryDayPreview | null;
  previewAgency: (
    input: { date: string; terminalId: string; amounts: readonly LotteryAmount[]; tracks: readonly AgencyTrackAmount[] },
    editing?: LotteryDayKey,
  ) => AgencyDayPreview | null;
  activate: () => Promise<void>;
  recordDay: (input: RecordLotteryDayInput) => Promise<void>;
  updateDay: (input: UpdateLotteryDayInput) => Promise<void>;
  removeDay: (key: LotteryDayKey) => Promise<void>;
  saveAgencyDay: (input: RecordAgencyDayInput, editing?: LotteryDayKey) => Promise<string[]>;
  removeAgencyDay: (key: LotteryDayKey) => Promise<void>;
  recordDeposit: (input: RecordLotteryDepositInput) => Promise<void>;
  updateDeposit: (input: UpdateLotteryDepositInput) => Promise<void>;
  removeDeposit: (id: string) => Promise<void>;
  recordExpense: (input: RecordLotteryExpenseInput) => Promise<void>;
  updateExpense: (input: UpdateLotteryExpenseInput) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  updateCommission: (input: UpdateLotteryCommissionInput) => Promise<void>;
};

const unavailable = (): Promise<void> => Promise.reject(new Error("La quiniela no está disponible."));
const unavailableDays = (): Promise<string[]> => Promise.reject(new Error("La quiniela no está disponible."));

const UNAVAILABLE: LotteryContextValue = {
  status: "unavailable",
  snapshot: null,
  games: [],
  summary: null,
  account: null,
  agencyMonth: null,
  days: [],
  agencyDays: [],
  retry: () => {},
  previewDay: () => null,
  previewAgency: () => null,
  activate: unavailable,
  recordDay: unavailable,
  updateDay: unavailable,
  removeDay: unavailable,
  saveAgencyDay: unavailableDays,
  removeAgencyDay: unavailable,
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
 * Lives inside LedgerProvider. Deposits, expenses and commissions stay in the
 * lottery book. The unified day writes that book and, when the agency also
 * runs hípica, the racing book.
 */
export function LotteryProvider({ open, children }: { open: OpenLottery | null; children: ReactNode }) {
  const ledger = useLedger();
  const commitRacing = useRacingCommit();
  const agencyId = ledger.snapshot.agencyId;
  const available = open !== null && seesLottery(ledger.agencyMode);
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

  useEffect(() => {
    if (!current || current.status !== "open" || ledger.readOnly) {
      return;
    }
    const snapshot = current.repository.load();
    if (!snapshot) {
      return;
    }
    const next = withTicketGames(snapshot);
    if (next === snapshot) {
      return;
    }
    current.repository.save(next);
    setVersion((value) => value + 1);
  }, [current, ledger.readOnly]);

  const { role, displayName, viewMonth, summary: racingSummary, agencyMode, snapshot: racingSnapshot, readOnly } = ledger;
  const racingBook = agencyMode === "both" ? racingSnapshot : null;

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
      if (readOnly) {
        return Promise.reject(new Error("No se pudo guardar."));
      }
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
      games: snapshot ? listedLotteryGames(snapshot) : [],
      summary,
      account: summary ? summarizeAgencyAccount(summary) : null,
      agencyMonth: summary ? combineAgencyMonth(racingSummary, summary) : null,
      days: snapshot ? listLotteryDays(snapshot, viewMonth) : [],
      agencyDays: snapshot ? listAgencyDays(snapshot, null, viewMonth) : [],
      retry,
      previewDay: (amounts, editing) => (snapshot ? previewLotteryDay(snapshot, amounts, editing) : null),
      previewAgency: (input, editing) => (snapshot ? previewAgencyDay(snapshot, racingBook, input, editing) : null),
      activate: async () => {
        if (readOnly) {
          return;
        }
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
      saveAgencyDay: async (input, editing) => {
        const currentSnapshot = repository.load();
        if (!currentSnapshot) {
          throw new LedgerError("lottery-inactive");
        }
        const plan = planAgencyDay(currentSnapshot, racingBook, input, editing);
        let lotteryWritten = false;
        if (plan.lottery.kind !== "skip") {
          await publish(() => {
            applyLotteryPlan(repository, plan.lottery);
            lotteryWritten = true;
          });
        }
        if (plan.racing.length === 0) {
          return [];
        }
        try {
          let ids: string[] = [];
          await commitRacing((racingRepository) => {
            ids = applyRacingPlan(racingRepository, plan.racing);
          });
          return ids;
        } catch (error) {
          if (lotteryWritten) {
            throw new LedgerError("agency-day-partial");
          }
          throw error;
        }
      },
      removeAgencyDay: async (key) => {
        const currentSnapshot = repository.load();
        const hadLottery =
          currentSnapshot?.sales.some((sale) => sale.date === key.date && sale.terminalId === key.terminalId) ?? false;
        const racingDays = racingBook
          ? racingBook.days.filter(
              (day) =>
                day.agencyId === racingBook.agencyId && day.date === key.date && (day.terminalId ?? "1") === key.terminalId,
            )
          : [];
        if (!hadLottery && racingDays.length === 0) {
          throw new LedgerError("unknown-entry");
        }
        if (hadLottery) {
          await publish(() => removeLotteryDay(repository, key));
        }
        if (racingDays.length === 0) {
          return;
        }
        try {
          await commitRacing((racingRepository) => {
            for (const day of racingDays) {
              removeDay(racingRepository, day.id);
            }
          });
        } catch (error) {
          if (hadLottery) {
            throw new LedgerError("agency-day-partial");
          }
          throw error;
        }
      },
      recordDeposit: (input) => run(() => recordLotteryDeposit(repository, input)),
      updateDeposit: (input) => run(() => updateLotteryDeposit(repository, input)),
      removeDeposit: (id) => run(() => removeLotteryDeposit(repository, id)),
      recordExpense: (input) => run(() => recordLotteryExpense(repository, input)),
      updateExpense: (input) => run(() => updateLotteryExpense(repository, input)),
      removeExpense: (id) => run(() => removeLotteryExpense(repository, id)),
      updateCommission: (input) => run(() => updateLotteryCommission(repository, input)),
    };
  }, [agencyId, available, commitRacing, current, displayName, racingBook, racingSummary, readOnly, role, version, viewMonth]);

  return <LotteryContext.Provider value={value}>{children}</LotteryContext.Provider>;
}

export function useLottery(): LotteryContextValue {
  return useContext(LotteryContext);
}
