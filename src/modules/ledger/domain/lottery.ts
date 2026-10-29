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
  /** Apuestas. Commission is calculated on this, not on the net. */
  soldCents: Cents;
  prizesCents: Cents;
  cancelledCents: Cents;
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

/** Ticket order. The first seven rates come from one ticket. The last four are a provisional 14% until the owner confirms them. */
export const LOTTERY_GAMES: readonly LotteryGame[] = [
  { id: "quiniela-ciudad", name: "Quiniela Ciudad", commissionBasisPoints: 2000 },
  { id: "quini-6", name: "Quini 6", commissionBasisPoints: 1400 },
  { id: "loto-plus", name: "Loto Plus", commissionBasisPoints: 1400 },
  { id: "quiniela-poceada", name: "Quiniela Poceada", commissionBasisPoints: 2000 },
  { id: "hipica", name: "Hípica", commissionBasisPoints: 0 },
  { id: "loto-5-plus", name: "Loto 5 Plus", commissionBasisPoints: 1400 },
  { id: "brinco", name: "Brinco", commissionBasisPoints: 1400 },
  { id: "tombolina", name: "Tombolina", commissionBasisPoints: 1400 },
  { id: "la-grande", name: "La Grande de la Ciudad", commissionBasisPoints: 1400 },
  { id: "prode", name: "Prode", commissionBasisPoints: 1400 },
  { id: "quiniela-ya", name: "Quiniela YA", commissionBasisPoints: 1400 },
];

export const HIPICA_GAME_ID = "hipica";

export function isTicketGame(gameId: string): boolean {
  return LOTTERY_GAMES.some((game) => game.id === gameId);
}

/** Games the load screen and the home table show, in ticket order. */
export function listedLotteryGames(snapshot: LotterySnapshot): LotteryGame[] {
  return LOTTERY_GAMES.map((game) => snapshot.games.find((item) => item.id === game.id) ?? { ...game });
}

/** Replaces a pre-ticket list. Retired games with sales stay. Owner rates set after that stay. */
export function withTicketGames(snapshot: LotterySnapshot): LotterySnapshot {
  const migrated = snapshot.games.some((game) => game.id === "quiniela-ciudad");
  const ticket = LOTTERY_GAMES.map((game) => {
    const existing = snapshot.games.find((item) => item.id === game.id);
    if (!migrated || !existing) {
      return { ...game };
    }
    return { id: game.id, name: game.name, commissionBasisPoints: existing.commissionBasisPoints };
  });
  const used = new Set(snapshot.sales.map((sale) => sale.gameId));
  const retired = snapshot.games.filter((game) => !isTicketGame(game.id) && used.has(game.id));
  const games = [...ticket, ...retired];
  const same =
    games.length === snapshot.games.length &&
    games.every((game, index) => {
      const current = snapshot.games[index];
      return current?.id === game.id && current.name === game.name && current.commissionBasisPoints === game.commissionBasisPoints;
    });
  if (same) {
    return snapshot;
  }
  return { ...snapshot, games };
}

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

export function settleLotterySale(input: {
  soldCents: Cents;
  commissionBasisPoints: number;
  prizesCents?: Cents;
  cancelledCents?: Cents;
}): LotterySettlement {
  const commissionCents = applyBasisPoints(input.soldCents, input.commissionBasisPoints);
  const prizesCents = input.prizesCents ?? 0;
  const cancelledCents = input.cancelledCents ?? 0;
  return { commissionCents, amountToDepositCents: input.soldCents - cancelledCents - prizesCents - commissionCents };
}
