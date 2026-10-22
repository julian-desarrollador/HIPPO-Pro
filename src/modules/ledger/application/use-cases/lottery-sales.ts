import { LedgerError } from "../../domain/errors";
import {
  getLotteryGame,
  isTerminalId,
  settleLotterySale,
  type LotteryGameId,
  type LotterySale,
  type LotterySnapshot,
} from "../../domain/lottery";
import type { Cents } from "../../domain/money";
import type { TerminalId } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";

export type LotteryAmount = {
  gameId: LotteryGameId;
  soldCents: Cents;
};

export type RecordLotteryDayInput = {
  date: string;
  terminalId: string;
  amounts: LotteryAmount[];
};

export type UpdateLotteryDayInput = RecordLotteryDayInput & {
  fromDate: string;
  fromTerminalId: string;
};

export type LotteryDayKey = {
  date: string;
  terminalId: string;
};

export type LotteryPreviewLine = {
  gameId: LotteryGameId;
  name: string;
  commissionBasisPoints: number;
  soldCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export type LotteryDayPreview = {
  lines: LotteryPreviewLine[];
  soldCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

function sameDay(sale: LotterySale, key: LotteryDayKey): boolean {
  return sale.date === key.date && sale.terminalId === key.terminalId;
}

function soldByGame(amounts: readonly LotteryAmount[]): Map<string, Cents> {
  const sold = new Map<string, Cents>();
  for (const amount of amounts) {
    sold.set(amount.gameId, amount.soldCents);
  }
  return sold;
}

/** Day already loaded keeps its percentages. Games without a row take the current one. */
function percentFor(snapshot: LotterySnapshot, gameId: string, previous: readonly LotterySale[]): number {
  return previous.find((sale) => sale.gameId === gameId)?.commissionBasisPoints ?? getLotteryGame(snapshot, gameId).commissionBasisPoints;
}

export function previewLotteryDay(
  snapshot: LotterySnapshot,
  amounts: readonly LotteryAmount[],
  editing?: LotteryDayKey,
): LotteryDayPreview {
  const sold = soldByGame(amounts);
  const previous = editing ? snapshot.sales.filter((sale) => sameDay(sale, editing)) : [];
  const lines = snapshot.games.map((game) => {
    const soldCents = sold.get(game.id) ?? 0;
    const commissionBasisPoints = percentFor(snapshot, game.id, previous);
    return { gameId: game.id, name: game.name, commissionBasisPoints, soldCents, ...settleLotterySale({ soldCents, commissionBasisPoints }) };
  });
  return {
    lines,
    soldCents: lines.reduce((total, line) => total + line.soldCents, 0),
    commissionCents: lines.reduce((total, line) => total + line.commissionCents, 0),
    amountToDepositCents: lines.reduce((total, line) => total + line.amountToDepositCents, 0),
  };
}

function buildSales(
  snapshot: LotterySnapshot,
  input: RecordLotteryDayInput,
  previous: readonly LotterySale[],
): LotterySale[] {
  assertIsoDate(input.date);
  if (!isTerminalId(input.terminalId)) {
    throw new LedgerError("unknown-terminal");
  }
  const terminalId: TerminalId = input.terminalId;
  const sales: LotterySale[] = [];
  for (const [gameId, soldCents] of soldByGame(input.amounts)) {
    getLotteryGame(snapshot, gameId);
    assertCents(soldCents, { allowZero: true });
    if (soldCents === 0) {
      continue;
    }
    sales.push({
      id: createId("lottery-sale"),
      agencyId: snapshot.agencyId,
      date: input.date,
      terminalId,
      gameId,
      soldCents,
      commissionBasisPoints: percentFor(snapshot, gameId, previous),
    });
  }
  if (sales.length === 0) {
    throw new LedgerError("empty-entry");
  }
  return sales;
}

export function recordLotteryDay(repository: LotteryRepository, input: RecordLotteryDayInput): LotterySale[] {
  const snapshot = requireLottery(repository);
  const sales = buildSales(snapshot, input, []);
  if (snapshot.sales.some((sale) => sameDay(sale, input))) {
    throw new LedgerError("duplicate-lottery-day");
  }
  repository.save({ ...snapshot, sales: [...snapshot.sales, ...sales] });
  return sales;
}

export function updateLotteryDay(repository: LotteryRepository, input: UpdateLotteryDayInput): LotterySale[] {
  const snapshot = requireLottery(repository);
  const from = { date: input.fromDate, terminalId: input.fromTerminalId };
  const previous = snapshot.sales.filter((sale) => sameDay(sale, from));
  if (previous.length === 0) {
    throw new LedgerError("unknown-entry");
  }
  const sales = buildSales(snapshot, input, previous);
  const others = snapshot.sales.filter((sale) => !sameDay(sale, from));
  if (others.some((sale) => sameDay(sale, input))) {
    throw new LedgerError("duplicate-lottery-day");
  }
  repository.save({ ...snapshot, sales: [...others, ...sales] });
  return sales;
}

export function removeLotteryDay(repository: LotteryRepository, key: LotteryDayKey): void {
  const snapshot = requireLottery(repository);
  const kept = snapshot.sales.filter((sale) => !sameDay(sale, key));
  if (kept.length === snapshot.sales.length) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, sales: kept });
}
