import { LedgerError } from "../../domain/errors";
import {
  getLotteryGame,
  isTerminalId,
  listedLotteryGames,
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
  prizesCents?: Cents;
  cancelledCents?: Cents;
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
  prizesCents: Cents;
  cancelledCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export type LotteryDayPreview = {
  lines: LotteryPreviewLine[];
  soldCents: Cents;
  prizesCents: Cents;
  cancelledCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

function sameDay(sale: LotterySale, key: LotteryDayKey): boolean {
  return sale.date === key.date && sale.terminalId === key.terminalId;
}

function amountsByGame(amounts: readonly LotteryAmount[]): Map<string, LotteryAmount> {
  const byGame = new Map<string, LotteryAmount>();
  for (const amount of amounts) {
    byGame.set(amount.gameId, amount);
  }
  return byGame;
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
  const byGame = amountsByGame(amounts);
  const previous = editing ? snapshot.sales.filter((sale) => sameDay(sale, editing)) : [];
  const lines = listedLotteryGames(snapshot).map((game) => {
    const amount = byGame.get(game.id);
    const soldCents = amount?.soldCents ?? 0;
    const prizesCents = amount?.prizesCents ?? 0;
    const cancelledCents = amount?.cancelledCents ?? 0;
    const commissionBasisPoints = percentFor(snapshot, game.id, previous);
    return {
      gameId: game.id,
      name: game.name,
      commissionBasisPoints,
      soldCents,
      prizesCents,
      cancelledCents,
      ...settleLotterySale({ soldCents, prizesCents, cancelledCents, commissionBasisPoints }),
    };
  });
  return {
    lines,
    soldCents: lines.reduce((total, line) => total + line.soldCents, 0),
    prizesCents: lines.reduce((total, line) => total + line.prizesCents, 0),
    cancelledCents: lines.reduce((total, line) => total + line.cancelledCents, 0),
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
  for (const amount of amountsByGame(input.amounts).values()) {
    getLotteryGame(snapshot, amount.gameId);
    const soldCents = amount.soldCents;
    const prizesCents = amount.prizesCents ?? 0;
    const cancelledCents = amount.cancelledCents ?? 0;
    assertCents(soldCents, { allowZero: true });
    assertCents(prizesCents, { allowZero: true });
    assertCents(cancelledCents, { allowZero: true });
    if (soldCents === 0 && prizesCents === 0 && cancelledCents === 0) {
      continue;
    }
    sales.push({
      id: createId("lottery-sale"),
      agencyId: snapshot.agencyId,
      date: input.date,
      terminalId,
      gameId: amount.gameId,
      soldCents,
      prizesCents,
      cancelledCents,
      commissionBasisPoints: percentFor(snapshot, amount.gameId, previous),
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
