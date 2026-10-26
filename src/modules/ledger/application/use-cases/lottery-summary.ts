import { listedLotteryGames, settleLotterySale, type LotteryGameId, type LotterySale, type LotterySnapshot } from "../../domain/lottery";
import type { Cents } from "../../domain/money";
import type { TerminalId } from "../../domain/types";
import type { MonthSummary } from "./summarize-month";

export type LotteryDayRow = {
  /** Date and terminal: one row per terminal ticket. */
  id: string;
  date: string;
  terminalId: TerminalId;
  soldByGame: Record<LotteryGameId, Cents>;
  prizesByGame: Record<LotteryGameId, Cents>;
  cancelledByGame: Record<LotteryGameId, Cents>;
  soldCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export type LotteryGameMonth = {
  gameId: LotteryGameId;
  name: string;
  /** Current percentage of the game. */
  commissionBasisPoints: number;
  soldCents: Cents;
  prizesCents: Cents;
  cancelledCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export type LotteryMonthSummary = {
  agencyId: string;
  month: string;
  games: LotteryGameMonth[];
  dayCount: number;
  soldCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
  openingCents: Cents;
  depositsCents: Cents;
  owedCents: Cents;
  agencyExpenseCents: Cents;
  partnerWithdrawalCents: Cents;
  outflowCents: Cents;
  balanceCents: Cents;
};

function ownSales(snapshot: LotterySnapshot): LotterySale[] {
  return snapshot.sales.filter((sale) => sale.agencyId === snapshot.agencyId);
}

function toDeposit(sales: readonly LotterySale[]): Cents {
  return sales.reduce((total, sale) => total + settleLotterySale(sale).amountToDepositCents, 0);
}

export function lotteryDayId(date: string, terminalId: string): string {
  return `${date}|${terminalId}`;
}

export function listLotteryDays(snapshot: LotterySnapshot, month: string): LotteryDayRow[] {
  const rows = new Map<string, LotteryDayRow>();
  for (const sale of ownSales(snapshot)) {
    if (!sale.date.startsWith(month)) {
      continue;
    }
    const id = lotteryDayId(sale.date, sale.terminalId);
    const row = rows.get(id) ?? {
      id,
      date: sale.date,
      terminalId: sale.terminalId,
      soldByGame: {},
      prizesByGame: {},
      cancelledByGame: {},
      soldCents: 0,
      commissionCents: 0,
      amountToDepositCents: 0,
    };
    const settled = settleLotterySale(sale);
    row.soldByGame[sale.gameId] = (row.soldByGame[sale.gameId] ?? 0) + sale.soldCents;
    row.prizesByGame[sale.gameId] = (row.prizesByGame[sale.gameId] ?? 0) + (sale.prizesCents ?? 0);
    row.cancelledByGame[sale.gameId] = (row.cancelledByGame[sale.gameId] ?? 0) + (sale.cancelledCents ?? 0);
    row.soldCents += sale.soldCents;
    row.commissionCents += settled.commissionCents;
    row.amountToDepositCents += settled.amountToDepositCents;
    rows.set(id, row);
  }
  return [...rows.values()].sort(
    (left, right) => left.date.localeCompare(right.date) || left.terminalId.localeCompare(right.terminalId),
  );
}

export function summarizeLotteryMonth(snapshot: LotterySnapshot, month: string): LotteryMonthSummary {
  const sales = ownSales(snapshot);
  const monthSales = sales.filter((sale) => sale.date.startsWith(month));
  const deposits = snapshot.deposits.filter((deposit) => deposit.agencyId === snapshot.agencyId);
  const earlierSales = sales.filter((sale) => sale.date.slice(0, 7) < month);
  const earlierDeposits = deposits
    .filter((deposit) => deposit.date.slice(0, 7) < month)
    .reduce((total, deposit) => total + deposit.amountCents, 0);
  const openingCents = snapshot.openingCents + toDeposit(earlierSales) - earlierDeposits;
  const depositsCents = deposits
    .filter((deposit) => deposit.date.startsWith(month))
    .reduce((total, deposit) => total + deposit.amountCents, 0);

  const games = listedLotteryGames(snapshot).map((game) => {
    const gameSales = monthSales.filter((sale) => sale.gameId === game.id);
    const settled = gameSales.map((sale) => settleLotterySale(sale));
    return {
      gameId: game.id,
      name: game.name,
      commissionBasisPoints: game.commissionBasisPoints,
      soldCents: gameSales.reduce((total, sale) => total + sale.soldCents, 0),
      prizesCents: gameSales.reduce((total, sale) => total + (sale.prizesCents ?? 0), 0),
      cancelledCents: gameSales.reduce((total, sale) => total + (sale.cancelledCents ?? 0), 0),
      commissionCents: settled.reduce((total, line) => total + line.commissionCents, 0),
      amountToDepositCents: settled.reduce((total, line) => total + line.amountToDepositCents, 0),
    };
  });
  const settledMonth = monthSales.map((sale) => settleLotterySale(sale));
  const soldCents = monthSales.reduce((total, sale) => total + sale.soldCents, 0);
  const commissionCents = settledMonth.reduce((total, line) => total + line.commissionCents, 0);
  const amountToDepositCents = settledMonth.reduce((total, line) => total + line.amountToDepositCents, 0);

  const monthExpenses = snapshot.expenses.filter(
    (expense) => expense.agencyId === snapshot.agencyId && expense.month === month,
  );
  const agencyExpenseCents = monthExpenses
    .filter((expense) => expense.kind === "agency")
    .reduce((total, expense) => total + expense.amountCents, 0);
  const partnerWithdrawalCents = monthExpenses
    .filter((expense) => expense.kind === "partner-withdrawal")
    .reduce((total, expense) => total + expense.amountCents, 0);
  const outflowCents = agencyExpenseCents + partnerWithdrawalCents;

  return {
    agencyId: snapshot.agencyId,
    month,
    games,
    dayCount: new Set(monthSales.map((sale) => sale.date)).size,
    soldCents,
    commissionCents,
    amountToDepositCents,
    openingCents,
    depositsCents,
    owedCents: openingCents + amountToDepositCents - depositsCents,
    agencyExpenseCents,
    partnerWithdrawalCents,
    outflowCents,
    balanceCents: commissionCents - outflowCents,
  };
}

export type BusinessMonth = {
  earningsCents: Cents;
  agencyExpenseCents: Cents;
  partnerWithdrawalCents: Cents;
  balanceCents: Cents;
};

export type AgencyMonth = {
  racing: BusinessMonth;
  lottery: BusinessMonth;
  total: BusinessMonth;
};

/** Reads both summaries. Neither book changes. */
export function combineAgencyMonth(racing: MonthSummary, lottery: LotteryMonthSummary): AgencyMonth {
  const racingMonth: BusinessMonth = {
    earningsCents: racing.billingCents,
    agencyExpenseCents: racing.agencyExpenseCents,
    partnerWithdrawalCents: racing.partnerWithdrawalCents,
    balanceCents: racing.balanceCents,
  };
  const lotteryMonth: BusinessMonth = {
    earningsCents: lottery.commissionCents,
    agencyExpenseCents: lottery.agencyExpenseCents,
    partnerWithdrawalCents: lottery.partnerWithdrawalCents,
    balanceCents: lottery.balanceCents,
  };
  return {
    racing: racingMonth,
    lottery: lotteryMonth,
    total: {
      earningsCents: racingMonth.earningsCents + lotteryMonth.earningsCents,
      agencyExpenseCents: racingMonth.agencyExpenseCents + lotteryMonth.agencyExpenseCents,
      partnerWithdrawalCents: racingMonth.partnerWithdrawalCents + lotteryMonth.partnerWithdrawalCents,
      balanceCents: racingMonth.balanceCents + lotteryMonth.balanceCents,
    },
  };
}
