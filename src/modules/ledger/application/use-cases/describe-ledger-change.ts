import { bettorPlayAmounts } from "../../domain/bettor-account";
import { listExpenseCategories } from "../../domain/expense-categories";
import { formatCents, formatSignedPercent } from "../../domain/money";
import { currentCommissionBasisPoints, listRacetracks } from "../../domain/racetracks";
import type { AuditEntry, BettorPlay, LedgerSnapshot, ViewerRole } from "../../domain/types";
import { createId } from "../create-id";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

function trackName(snapshot: LedgerSnapshot, id: string): string {
  return listRacetracks(snapshot).find((track) => track.id === id)?.name ?? id;
}

function categoryName(snapshot: LedgerSnapshot, id: string): string {
  return listExpenseCategories(snapshot).find((category) => category.id === id)?.label ?? id;
}

function bettorName(snapshot: LedgerSnapshot, id: string): string {
  return snapshot.bettors?.find((bettor) => bettor.id === id)?.name ?? id;
}

function playStake(play: BettorPlay): number {
  return bettorPlayAmounts(play).stakeCents;
}

function playPayout(play: BettorPlay): number {
  return bettorPlayAmounts(play).payoutCents;
}

function diffRacetracks(before: LedgerSnapshot, after: LedgerSnapshot): { lines: string[]; editedIds: Set<string> } {
  const lines: string[] = [];
  const editedIds = new Set<string>();
  const previous = new Map(listRacetracks(before).map((track) => [track.id, track]));
  const next = new Map(listRacetracks(after).map((track) => [track.id, track]));

  for (const [id, track] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Agregó el hipódromo ${track.name}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.name !== track.name) {
      clauses.push(`El nombre pasó a ${track.name}.`);
    }
    const oldCommission = currentCommissionBasisPoints(id, before.commissions, before);
    const newCommission = currentCommissionBasisPoints(id, after.commissions, after);
    if (oldCommission !== newCommission) {
      clauses.push(`La comisión pasó de ${formatSignedPercent(oldCommission)} a ${formatSignedPercent(newCommission)}.`);
      editedIds.add(id);
    }
    const adjustmentChanged = old.depositAdjustmentBasisPoints !== track.depositAdjustmentBasisPoints;
    if (adjustmentChanged) {
      clauses.push(
        `El ajuste pasó de ${formatSignedPercent(old.depositAdjustmentBasisPoints)} a ${formatSignedPercent(track.depositAdjustmentBasisPoints)}.`,
      );
    }
    if (clauses.length === 1 && oldCommission !== newCommission && old.name === track.name && !adjustmentChanged) {
      lines.push(
        `Cambió la comisión de ${old.name} de ${formatSignedPercent(oldCommission)} a ${formatSignedPercent(newCommission)}.`,
      );
    } else if (clauses.length > 0) {
      lines.push(`Editó el hipódromo ${old.name}. ${clauses.join(" ")}`);
    }
  }

  for (const [id, track] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el hipódromo ${track.name}.`);
      editedIds.add(id);
    }
  }

  return { lines, editedIds };
}

function diffCommissions(before: LedgerSnapshot, after: LedgerSnapshot, skip: ReadonlySet<string>): string[] {
  const lines: string[] = [];
  const ids = new Set([...listRacetracks(before), ...listRacetracks(after)].map((track) => track.id));
  for (const id of ids) {
    if (skip.has(id)) {
      continue;
    }
    const oldCommission = currentCommissionBasisPoints(id, before.commissions, before);
    const newCommission = currentCommissionBasisPoints(id, after.commissions, after);
    if (oldCommission === newCommission) {
      continue;
    }
    if (!listRacetracks(after).some((track) => track.id === id)) {
      continue;
    }
    lines.push(
      `Cambió la comisión de ${trackName(after, id)} de ${formatSignedPercent(oldCommission)} a ${formatSignedPercent(newCommission)}.`,
    );
  }
  return lines;
}

function diffDays(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(before.days.map((day) => [day.id, day]));
  const next = new Map(after.days.map((day) => [day.id, day]));
  for (const [id, day] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó el día ${formatDay(day.date)} de ${trackName(after, day.racetrackId)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== day.date) {
      clauses.push(`La fecha pasó a ${formatDay(day.date)}.`);
    }
    if (old.racetrackId !== day.racetrackId) {
      clauses.push(`El hipódromo pasó a ${trackName(after, day.racetrackId)}.`);
    }
    if (old.soldCents !== day.soldCents) {
      clauses.push(`Vendido pasó de ${formatCents(old.soldCents)} a ${formatCents(day.soldCents)}.`);
    }
    if (old.cancelledCents !== day.cancelledCents) {
      clauses.push(`Cancelados pasó de ${formatCents(old.cancelledCents)} a ${formatCents(day.cancelledCents)}.`);
    }
    if (old.paidCents !== day.paidCents) {
      clauses.push(`Pagado pasó de ${formatCents(old.paidCents)} a ${formatCents(day.paidCents)}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó el día ${formatDay(old.date)} de ${trackName(before, old.racetrackId)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, day] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el día ${formatDay(day.date)} de ${trackName(before, day.racetrackId)}.`);
    }
  }
  return lines;
}

function diffDeposits(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(before.deposits.map((deposit) => [deposit.id, deposit]));
  const next = new Map(after.deposits.map((deposit) => [deposit.id, deposit]));
  for (const [id, deposit] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó un depósito de ${formatCents(deposit.amountCents)} en ${trackName(after, deposit.racetrackId)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== deposit.date) {
      clauses.push(`La fecha pasó a ${formatDay(deposit.date)}.`);
    }
    if (old.racetrackId !== deposit.racetrackId) {
      clauses.push(`El hipódromo pasó a ${trackName(after, deposit.racetrackId)}.`);
    }
    if (old.amountCents !== deposit.amountCents) {
      clauses.push(`El monto pasó de ${formatCents(old.amountCents)} a ${formatCents(deposit.amountCents)}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó el depósito de ${trackName(before, old.racetrackId)} del ${formatDay(old.date)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, deposit] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el depósito de ${trackName(before, deposit.racetrackId)} del ${formatDay(deposit.date)}.`);
    }
  }
  return lines;
}

function diffExpenses(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(before.expenses.map((expense) => [expense.id, expense]));
  const next = new Map(after.expenses.map((expense) => [expense.id, expense]));
  for (const [id, expense] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó un gasto de ${formatCents(expense.amountCents)} en ${categoryName(after, expense.categoryId)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.paidOn !== expense.paidOn) {
      clauses.push(`La fecha pasó a ${formatDay(expense.paidOn)}.`);
    }
    if (old.categoryId !== expense.categoryId) {
      clauses.push(`La categoría pasó a ${categoryName(after, expense.categoryId)}.`);
    }
    if (old.detail !== expense.detail) {
      clauses.push(expense.detail ? `El detalle pasó a ${expense.detail}.` : "Sacó el detalle.");
    }
    if (old.amountCents !== expense.amountCents) {
      clauses.push(`El monto pasó de ${formatCents(old.amountCents)} a ${formatCents(expense.amountCents)}.`);
    }
    if (old.month !== expense.month) {
      clauses.push(`El mes pasó a ${expense.month}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó un gasto de ${categoryName(before, old.categoryId)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, expense] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó un gasto de ${categoryName(before, expense.categoryId)}.`);
    }
  }
  return lines;
}

function diffCategories(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map(listExpenseCategories(before).map((category) => [category.id, category]));
  const next = new Map(listExpenseCategories(after).map((category) => [category.id, category]));
  for (const [id, category] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Agregó la categoría ${category.label}.`);
    } else if (old.label !== category.label) {
      lines.push(`Renombró la categoría ${old.label} a ${category.label}.`);
    }
  }
  for (const [id, category] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó la categoría ${category.label}.`);
    }
  }
  return lines;
}

function diffBettors(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.bettors ?? []).map((bettor) => [bettor.id, bettor]));
  const next = new Map((after.bettors ?? []).map((bettor) => [bettor.id, bettor]));
  for (const [id, bettor] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Agregó el apostador ${bettor.name}.`);
    } else if (old.name !== bettor.name) {
      lines.push(`Renombró el apostador ${old.name} a ${bettor.name}.`);
    }
  }
  for (const [id, bettor] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el apostador ${bettor.name}.`);
    }
  }
  return lines;
}

function diffPlays(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.bettorPlays ?? []).map((play) => [play.id, play]));
  const next = new Map((after.bettorPlays ?? []).map((play) => [play.id, play]));
  for (const [id, play] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(
        `Cargó un día de ${bettorName(after, play.bettorId)}: apostó ${formatCents(playStake(play))} y cobró ${formatCents(playPayout(play))}.`,
      );
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== play.date) {
      clauses.push(`La fecha pasó a ${formatDay(play.date)}.`);
    }
    if (old.bettorId !== play.bettorId) {
      clauses.push(`El apostador pasó a ${bettorName(after, play.bettorId)}.`);
    }
    if (playStake(old) !== playStake(play)) {
      clauses.push(`Lo apostado pasó de ${formatCents(playStake(old))} a ${formatCents(playStake(play))}.`);
    }
    if (playPayout(old) !== playPayout(play)) {
      clauses.push(`Lo cobrado pasó de ${formatCents(playPayout(old))} a ${formatCents(playPayout(play))}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó un día de ${bettorName(before, old.bettorId)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, play] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó un día de ${bettorName(before, play.bettorId)}.`);
    }
  }
  return lines;
}

function diffPayments(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.bettorPayments ?? []).map((payment) => [payment.id, payment]));
  const next = new Map((after.bettorPayments ?? []).map((payment) => [payment.id, payment]));
  for (const [id, payment] of next) {
    const old = previous.get(id);
    if (!old) {
      lines.push(`Cargó un pago de ${formatCents(payment.amountCents)} de ${bettorName(after, payment.bettorId)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== payment.date) {
      clauses.push(`La fecha pasó a ${formatDay(payment.date)}.`);
    }
    if (old.bettorId !== payment.bettorId) {
      clauses.push(`El apostador pasó a ${bettorName(after, payment.bettorId)}.`);
    }
    if (old.amountCents !== payment.amountCents) {
      clauses.push(`El monto pasó de ${formatCents(old.amountCents)} a ${formatCents(payment.amountCents)}.`);
    }
    if (clauses.length > 0) {
      lines.push(`Editó un pago de ${bettorName(before, old.bettorId)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, payment] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó un pago de ${bettorName(before, payment.bettorId)}.`);
    }
  }
  return lines;
}

export function describeLedgerChange(before: LedgerSnapshot, after: LedgerSnapshot): string | null {
  const racetracks = diffRacetracks(before, after);
  const lines = [
    ...racetracks.lines,
    ...diffCommissions(before, after, racetracks.editedIds),
    ...diffDays(before, after),
    ...diffDeposits(before, after),
    ...diffExpenses(before, after),
    ...diffCategories(before, after),
    ...diffBettors(before, after),
    ...diffPlays(before, after),
    ...diffPayments(before, after),
  ];
  if (lines.length === 0) {
    return null;
  }
  return lines.join(" ");
}

export function withAuditEntry(before: LedgerSnapshot, after: LedgerSnapshot, actor: ViewerRole, at: string): LedgerSnapshot {
  const summary = describeLedgerChange(before, after);
  if (!summary) {
    return after;
  }
  const entry: AuditEntry = { id: createId("audit"), at, actor, summary };
  return { ...after, audit: [...(after.audit ?? []), entry] };
}

export function withRestoreAudit(snapshot: LedgerSnapshot, actor: ViewerRole, at: string): LedgerSnapshot {
  const entry: AuditEntry = {
    id: createId("audit"),
    at,
    actor,
    summary: "Volvió a los datos de agosto.",
  };
  return { ...snapshot, audit: [entry] };
}
