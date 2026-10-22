import { LedgerError } from "./errors";
import { applyBasisPoints, type Cents } from "./money";
import type { AuditEntry, ExpenseKind, TerminalId } from "./types";

export type LotteryGameId = string;

export type LotteryGame = {
  id: LotteryGameId;
  name: string;
  commissionBasisPoints: number;
};

export type LotterySale = {
  id: string;
  agencyId: string;
  date: string;
  terminalId: TerminalId;
  gameId: LotteryGameId;
  soldCents: Cents;
  /** Copied from the game when the day is recorded. */
  commissionBasisPoints: number;
};

export type LotteryDeposit = {
  id: string;
  agencyId: string;
  date: string;
  amountCents: Cents;
};

export type LotteryExpense = {
  id: string;
  agencyId: string;
  month: string;
  paidOn: string;
  detail: string;
  amountCents: Cents;
  kind: ExpenseKind;
};

/** The lottery book. Stored apart from the racing LedgerSnapshot. */
export type LotterySnapshot = {
  agencyId: string;
  activatedAt: string;
  activatedBy: string;
  /** Month of the activation. */
  month: string;
  games: LotteryGame[];
  sales: LotterySale[];
  deposits: LotteryDeposit[];
  expenses: LotteryExpense[];
  /** Owed to the lottery before the first sale. */
  openingCents: Cents;
  audit: AuditEntry[];
};

export const LOTTERY_GAMES: readonly LotteryGame[] = [
  { id: "quiniela", name: "Quiniela", commissionBasisPoints: 2000 },
  { id: "plus", name: "Plus", commissionBasisPoints: 2000 },
  { id: "telekino", name: "Telekino", commissionBasisPoints: 1500 },
  { id: "brinco", name: "Brinco", commissionBasisPoints: 1350 },
  { id: "loto", name: "Loto", commissionBasisPoints: 1460 },
  { id: "quini", name: "Quini", commissionBasisPoints: 1350 },
];

export const TERMINAL_IDS: readonly TerminalId[] = ["1", "2", "3", "4"];

export function isTerminalId(value: string): value is TerminalId {
  return (TERMINAL_IDS as readonly string[]).includes(value);
}

export function getLotteryGame(snapshot: LotterySnapshot, gameId: string): LotteryGame {
  const game = snapshot.games.find((item) => item.id === gameId);
  if (!game) {
    throw new LedgerError("unknown-game");
  }
  return game;
}

export type LotterySettlement = {
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export function settleLotterySale(input: { soldCents: Cents; commissionBasisPoints: number }): LotterySettlement {
  const commissionCents = applyBasisPoints(input.soldCents, input.commissionBasisPoints);
  return { commissionCents, amountToDepositCents: input.soldCents - commissionCents };
}
