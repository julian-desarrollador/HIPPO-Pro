import { LedgerError } from "../../domain/errors";
import { settleDay } from "../../domain/calculations";
import { getLotteryGame, isTerminalId, type LotterySnapshot } from "../../domain/lottery";
import type { Cents } from "../../domain/money";
import { getRacetrack } from "../../domain/racetracks";
import type { DailySale, LedgerSnapshot, TerminalId } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";
import { lotteryDayId, listLotteryDays } from "./lottery-summary";
import { daySlotConflict, recordDay, type RecordDayInput } from "./record-day";
import { removeDay } from "./remove-entry";
import { listSettledDays } from "./summarize-month";
import { updateDay, type UpdateDayInput } from "./update-day";
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
} from "./lottery-sales";

export type AgencyTrackAmount = {
  racetrackId: string;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
};

export type RecordAgencyDayInput = {
  date: string;
  terminalId: string;
  /** Null leaves the lottery book as it is. An empty list clears it when editing. */
  amounts: LotteryAmount[] | null;
  /** Null leaves the racing book as it is. An empty track is not stored. */
  tracks: AgencyTrackAmount[] | null;
};

export type UpdateAgencyDayInput = RecordAgencyDayInput & {
  fromDate: string;
  fromTerminalId: string;
};

export type AgencyTrackPreview = {
  racetrackId: string;
  name: string;
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export type AgencyDayPreview = {
  lines: LotteryDayPreview["lines"];
  tracks: AgencyTrackPreview[];
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

/** One row per date and terminal, games and hípica together. */
export type AgencyDayRow = {
  id: string;
  date: string;
  terminalId: TerminalId;
  soldByGame: Record<string, Cents>;
  prizesByGame: Record<string, Cents>;
  cancelledByGame: Record<string, Cents>;
  racingNetCents: Cents;
  soldCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

type LotteryOp =
  | { kind: "skip" }
  | { kind: "record"; input: RecordLotteryDayInput }
  | { kind: "update"; input: UpdateLotteryDayInput }
  | { kind: "remove"; key: LotteryDayKey };

type RacingOp =
  | { kind: "record"; input: RecordDayInput }
  | { kind: "update"; input: UpdateDayInput }
  | { kind: "remove"; id: string };

export type AgencyDayPlan = {
  lottery: LotteryOp;
  racing: RacingOp[];
};

function filled(track: AgencyTrackAmount): boolean {
  return track.soldCents !== 0 || track.cancelledCents !== 0 || track.paidCents !== 0;
}

function daysForSlot(snapshot: LedgerSnapshot, date: string, terminalId: string): DailySale[] {
  return snapshot.days.filter(
    (day) => day.agencyId === snapshot.agencyId && day.date === date && (day.terminalId ?? "1") === terminalId,
  );
}

function lotteryOperation(snapshot: LotterySnapshot, input: RecordAgencyDayInput, editing?: LotteryDayKey): LotteryOp {
  if (input.amounts === null) {
    return { kind: "skip" };
  }
  assertIsoDate(input.date);
  if (!isTerminalId(input.terminalId)) {
    throw new LedgerError("unknown-terminal");
  }
  for (const amount of input.amounts) {
    getLotteryGame(snapshot, amount.gameId);
    assertCents(amount.soldCents, { allowZero: true });
    assertCents(amount.prizesCents ?? 0, { allowZero: true });
    assertCents(amount.cancelledCents ?? 0, { allowZero: true });
  }
  const hasAmount = input.amounts.some(
    (amount) => amount.soldCents > 0 || (amount.prizesCents ?? 0) > 0 || (amount.cancelledCents ?? 0) > 0,
  );
  const previous = editing
    ? snapshot.sales.some((sale) => sale.date === editing.date && sale.terminalId === editing.terminalId)
    : false;
  if (!hasAmount) {
    return previous && editing ? { kind: "remove", key: editing } : { kind: "skip" };
  }
  const occupied = snapshot.sales.some((sale) => sale.date === input.date && sale.terminalId === input.terminalId);
  const sameSlot = editing !== undefined && editing.date === input.date && editing.terminalId === input.terminalId;
  if (previous && editing) {
    if (occupied && !sameSlot) {
      throw new LedgerError("duplicate-lottery-day");
    }
    return {
      kind: "update",
      input: {
        fromDate: editing.date,
        fromTerminalId: editing.terminalId,
        date: input.date,
        terminalId: input.terminalId,
        amounts: input.amounts,
      },
    };
  }
  if (occupied) {
    throw new LedgerError("duplicate-lottery-day");
  }
  return { kind: "record", input: { date: input.date, terminalId: input.terminalId, amounts: input.amounts } };
}

function racingOperations(snapshot: LedgerSnapshot, input: RecordAgencyDayInput, editing?: LotteryDayKey): RacingOp[] {
  if (input.tracks === null) {
    return [];
  }
  assertIsoDate(input.date);
  if (!isTerminalId(input.terminalId)) {
    throw new LedgerError("unknown-terminal");
  }
  const terminalId: TerminalId = input.terminalId;
  const existing = editing ? daysForSlot(snapshot, editing.date, editing.terminalId) : [];
  const ops: RacingOp[] = [];
  const kept = new Set<string>();
  for (const track of input.tracks) {
    if (!filled(track)) {
      continue;
    }
    getRacetrack(track.racetrackId, snapshot);
    assertCents(track.soldCents, { allowZero: true });
    assertCents(track.cancelledCents, { allowZero: true });
    assertCents(track.paidCents, { allowZero: true });
    const current = existing.find((day) => day.racetrackId === track.racetrackId);
    const recordInput: RecordDayInput = {
      date: input.date,
      racetrackId: track.racetrackId,
      terminalId,
      soldCents: track.soldCents,
      cancelledCents: track.cancelledCents,
      paidCents: track.paidCents,
    };
    const conflict = daySlotConflict(snapshot.days, {
      id: current?.id,
      date: input.date,
      racetrackId: track.racetrackId,
      agencyId: snapshot.agencyId,
      terminalId,
    });
    if (conflict) {
      throw new LedgerError(conflict);
    }
    if (current) {
      kept.add(current.id);
      ops.push({ kind: "update", input: { ...recordInput, id: current.id } });
    } else {
      ops.push({ kind: "record", input: recordInput });
    }
  }
  for (const day of existing) {
    if (!kept.has(day.id)) {
      ops.push({ kind: "remove", id: day.id });
    }
  }
  return ops;
}

/** Checks both books and builds the writes. Nothing is saved here. */
export function planAgencyDay(
  lottery: LotterySnapshot,
  racing: LedgerSnapshot | null,
  input: RecordAgencyDayInput,
  editing?: LotteryDayKey,
): AgencyDayPlan {
  const lotteryOp = lotteryOperation(lottery, input, editing);
  const racingOps = racing ? racingOperations(racing, input, editing) : [];
  const lotterySaves = lotteryOp.kind === "record" || lotteryOp.kind === "update";
  const racingSaves = racingOps.some((op) => op.kind !== "remove");
  if (!lotterySaves && !racingSaves) {
    throw new LedgerError("empty-entry");
  }
  return { lottery: lotteryOp, racing: racingOps };
}

export function applyLotteryPlan(repository: LotteryRepository, op: LotteryOp): void {
  if (op.kind === "record") {
    recordLotteryDay(repository, op.input);
  } else if (op.kind === "update") {
    updateLotteryDay(repository, op.input);
  } else if (op.kind === "remove") {
    removeLotteryDay(repository, op.key);
  }
}

/** Removes first, then updates, then new rows. Returns the ids that remain. */
export function applyRacingPlan(repository: LedgerRepository, ops: readonly RacingOp[]): string[] {
  for (const op of ops) {
    if (op.kind === "remove") {
      removeDay(repository, op.id);
    }
  }
  const ids: string[] = [];
  for (const op of ops) {
    if (op.kind === "update") {
      ids.push(updateDay(repository, op.input).id);
    }
  }
  for (const op of ops) {
    if (op.kind === "record") {
      ids.push(recordDay(repository, op.input).id);
    }
  }
  return ids;
}

function commit(
  lottery: LotteryRepository,
  racing: LedgerRepository | null,
  plan: AgencyDayPlan,
): string[] {
  let lotteryWritten = false;
  try {
    applyLotteryPlan(lottery, plan.lottery);
    lotteryWritten = plan.lottery.kind !== "skip";
    if (!racing || plan.racing.length === 0) {
      return [];
    }
    return applyRacingPlan(racing, plan.racing);
  } catch (error) {
    if (lotteryWritten && plan.racing.length > 0) {
      throw new LedgerError("agency-day-partial");
    }
    throw error;
  }
}

export function previewAgencyDay(
  lottery: LotterySnapshot,
  racing: LedgerSnapshot | null,
  input: { date: string; terminalId: string; amounts: readonly LotteryAmount[]; tracks: readonly AgencyTrackAmount[] },
  editing?: LotteryDayKey,
): AgencyDayPreview {
  const lotteryPreview = previewLotteryDay(lottery, input.amounts, editing);
  const tracks: AgencyTrackPreview[] = [];
  if (racing) {
    const existing = editing ? daysForSlot(racing, editing.date, editing.terminalId) : [];
    for (const track of input.tracks) {
      if (!filled(track)) {
        continue;
      }
      const rule = getRacetrack(track.racetrackId, racing);
      const stored = existing.find((day) => day.racetrackId === track.racetrackId);
      const settled = settleDay({
        racetrackId: track.racetrackId,
        soldCents: track.soldCents,
        cancelledCents: track.cancelledCents,
        paidCents: track.paidCents,
        commissionBasisPoints: stored?.commissionBasisPoints,
        depositAdjustmentBasisPoints: stored?.depositAdjustmentBasisPoints ?? rule.depositAdjustmentBasisPoints,
      });
      tracks.push({
        racetrackId: track.racetrackId,
        name: rule.name,
        netCents: settled.netCents,
        commissionCents: settled.commissionCents,
        amountToDepositCents: settled.amountToDepositCents,
      });
    }
  }
  const netCents = tracks.reduce((total, track) => total + track.netCents, 0);
  const commissionCents = tracks.reduce((total, track) => total + track.commissionCents, 0);
  const amountToDepositCents = tracks.reduce((total, track) => total + track.amountToDepositCents, 0);
  return {
    lines: lotteryPreview.lines,
    tracks,
    netCents: lotteryPreview.soldCents + netCents,
    commissionCents: lotteryPreview.commissionCents + commissionCents,
    amountToDepositCents: lotteryPreview.amountToDepositCents + amountToDepositCents,
  };
}

export function recordAgencyDay(
  lottery: LotteryRepository,
  racing: LedgerRepository | null,
  input: RecordAgencyDayInput,
): string[] {
  const lotterySnapshot = requireLottery(lottery);
  const plan = planAgencyDay(lotterySnapshot, racing?.load() ?? null, input);
  return commit(lottery, racing, plan);
}

export function updateAgencyDay(
  lottery: LotteryRepository,
  racing: LedgerRepository | null,
  input: UpdateAgencyDayInput,
): string[] {
  const lotterySnapshot = requireLottery(lottery);
  const plan = planAgencyDay(lotterySnapshot, racing?.load() ?? null, input, {
    date: input.fromDate,
    terminalId: input.fromTerminalId,
  });
  return commit(lottery, racing, plan);
}

export function removeAgencyDay(
  lottery: LotteryRepository,
  racing: LedgerRepository | null,
  key: LotteryDayKey,
): void {
  const lotterySnapshot = requireLottery(lottery);
  const hadLottery = lotterySnapshot.sales.some((sale) => sale.date === key.date && sale.terminalId === key.terminalId);
  const racingDays = racing ? daysForSlot(racing.load(), key.date, key.terminalId) : [];
  if (!hadLottery && racingDays.length === 0) {
    throw new LedgerError("unknown-entry");
  }
  if (hadLottery) {
    removeLotteryDay(lottery, key);
  }
  if (!racing || racingDays.length === 0) {
    return;
  }
  try {
    for (const day of racingDays) {
      removeDay(racing, day.id);
    }
  } catch (error) {
    if (hadLottery) {
      throw new LedgerError("agency-day-partial");
    }
    throw error;
  }
}

export function listAgencyDays(
  lottery: LotterySnapshot,
  racing: LedgerSnapshot | null,
  month: string,
): AgencyDayRow[] {
  const rows = new Map<string, AgencyDayRow>();
  for (const day of listLotteryDays(lottery, month)) {
    rows.set(day.id, {
      id: day.id,
      date: day.date,
      terminalId: day.terminalId,
      soldByGame: day.soldByGame,
      prizesByGame: day.prizesByGame,
      cancelledByGame: day.cancelledByGame,
      racingNetCents: 0,
      soldCents: day.soldCents,
      commissionCents: day.commissionCents,
      amountToDepositCents: day.amountToDepositCents,
    });
  }
  if (racing) {
    for (const day of listSettledDays(racing, month)) {
      const terminalId = day.terminalId ?? "1";
      if (!isTerminalId(terminalId)) {
        continue;
      }
      const id = lotteryDayId(day.date, terminalId);
      const row = rows.get(id) ?? {
        id,
        date: day.date,
        terminalId,
        soldByGame: {},
        prizesByGame: {},
        cancelledByGame: {},
        racingNetCents: 0,
        soldCents: 0,
        commissionCents: 0,
        amountToDepositCents: 0,
      };
      row.racingNetCents += day.netCents;
      row.soldCents += day.netCents;
      row.commissionCents += day.commissionCents;
      row.amountToDepositCents += day.amountToDepositCents;
      rows.set(id, row);
    }
  }
  return [...rows.values()].sort(
    (left, right) => left.date.localeCompare(right.date) || left.terminalId.localeCompare(right.terminalId),
  );
}
