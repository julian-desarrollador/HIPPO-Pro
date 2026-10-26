import type { LotteryExpense, LotterySnapshot } from "../../domain/lottery";
import { formatCents, formatSignedPercent } from "../../domain/money";
import type { AuditEntry, ViewerRole } from "../../domain/types";
import { createId } from "../create-id";
import { lotteryDayId } from "./lottery-summary";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

type DayTotal = {
  date: string;
  terminalId: string;
  soldCents: number;
  /** Game, amount and percent of every row, to notice edits that keep the total. */
  signature: string;
};

function dayTotals(snapshot: LotterySnapshot): Map<string, DayTotal> {
  const days = new Map<string, DayTotal>();
  const sorted = snapshot.sales.slice().sort((left, right) => left.gameId.localeCompare(right.gameId));
  for (const sale of sorted) {
    const id = lotteryDayId(sale.date, sale.terminalId);
    const day = days.get(id) ?? { date: sale.date, terminalId: sale.terminalId, soldCents: 0, signature: "" };
    day.soldCents += sale.soldCents;
    day.signature += `${sale.gameId}:${sale.soldCents}:${sale.prizesCents ?? 0}:${sale.cancelledCents ?? 0}:${sale.commissionBasisPoints};`;
    days.set(id, day);
  }
  return days;
}

function dayLabel(day: DayTotal): string {
  return `${formatDay(day.date)} en Terminal ${day.terminalId}`;
}

function diffDays(before: LotterySnapshot, after: LotterySnapshot): string[] {
  const lines: string[] = [];
  const previous = dayTotals(before);
  const next = dayTotals(after);
  for (const [id, day] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó la quiniela del ${dayLabel(day)}: vendió ${formatCents(day.soldCents)}.`);
    } else if (old.soldCents !== day.soldCents) {
      lines.push(`Editó la quiniela del ${dayLabel(day)}. Vendido pasó de ${formatCents(old.soldCents)} a ${formatCents(day.soldCents)}.`);
    } else if (old.signature !== day.signature) {
      lines.push(`Editó la quiniela del ${dayLabel(day)}.`);
    }
  }
  for (const [id, day] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó la quiniela del ${dayLabel(day)}.`);
    }
  }
  return lines;
}

function diffGames(before: LotterySnapshot, after: LotterySnapshot): string[] {
  const previous = new Map(before.games.map((game) => [game.id, game]));
  return after.games.flatMap((game) => {
    const old = previous.get(game.id);
    if (!old || old.commissionBasisPoints === game.commissionBasisPoints) {
      return [];
    }
    return [
      `Cambió la comisión de ${game.name} de ${formatSignedPercent(old.commissionBasisPoints)} a ${formatSignedPercent(game.commissionBasisPoints)}.`,
    ];
  });
}

function diffDeposits(before: LotterySnapshot, after: LotterySnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(before.deposits.map((deposit) => [deposit.id, deposit]));
  const next = new Map(after.deposits.map((deposit) => [deposit.id, deposit]));
  for (const [id, deposit] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó un depósito de ${formatCents(deposit.amountCents)} a la lotería.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== deposit.date) {
      clauses.push(`La fecha pasó a ${formatDay(deposit.date)}.`);
    }
    if (old.amountCents !== deposit.amountCents) {
      clauses.push(`El monto pasó de ${formatCents(old.amountCents)} a ${formatCents(deposit.amountCents)}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó el depósito a la lotería del ${formatDay(old.date)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, deposit] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el depósito a la lotería del ${formatDay(deposit.date)}.`);
    }
  }
  return lines;
}

function expenseNoun(expense: LotteryExpense): string {
  return expense.kind === "agency" ? "un gasto" : "un retiro";
}

function diffExpenses(before: LotterySnapshot, after: LotterySnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(before.expenses.map((expense) => [expense.id, expense]));
  const next = new Map(after.expenses.map((expense) => [expense.id, expense]));
  for (const [id, expense] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó ${expenseNoun(expense)} de quiniela de ${formatCents(expense.amountCents)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.paidOn !== expense.paidOn) {
      clauses.push(`La fecha pasó a ${formatDay(expense.paidOn)}.`);
    }
    if (old.kind !== expense.kind) {
      clauses.push(expense.kind === "agency" ? "Pasó a gasto de la agencia." : "Pasó a adelanto o retiro.");
    }
    if (old.detail !== expense.detail) {
      clauses.push(expense.detail ? `El detalle pasó a ${expense.detail}.` : "Sacó el detalle.");
    }
    if (old.amountCents !== expense.amountCents) {
      clauses.push(`El monto pasó de ${formatCents(old.amountCents)} a ${formatCents(expense.amountCents)}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó ${expenseNoun(old)} de quiniela. ${clauses.join(" ")}`);
    }
  }
  for (const [id, expense] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó ${expenseNoun(expense)} de quiniela.`);
    }
  }
  return lines;
}

export function describeLotteryChange(before: LotterySnapshot, after: LotterySnapshot): string | null {
  const lines = [
    ...diffGames(before, after),
    ...diffDays(before, after),
    ...diffDeposits(before, after),
    ...diffExpenses(before, after),
  ];
  return lines.length === 0 ? null : lines.join(" ");
}

export function withLotteryAudit(
  before: LotterySnapshot,
  after: LotterySnapshot,
  actor: ViewerRole,
  at: string,
  actorName?: string,
): LotterySnapshot {
  const summary = describeLotteryChange(before, after);
  if (!summary) {
    return after;
  }
  const name = actorName?.trim();
  const entry: AuditEntry = { id: createId("audit"), at, actor, summary, ...(name ? { actorName: name } : {}) };
  return { ...after, audit: [...after.audit, entry] };
}
