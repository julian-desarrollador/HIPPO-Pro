import { bettorPlayAmounts } from "../../domain/bettor-account";
import { incomeKindLabel } from "./summarize-cash-day";
import { expenseCategoryLabel, listExpenseCategories } from "../../domain/expense-categories";
import { formatCents, formatSignedPercent } from "../../domain/money";
import { currentCommissionBasisPoints, listRacetracks } from "../../domain/racetracks";
import type { AuditEntry, BettorPlay, CashIncome, LedgerSnapshot, ViewerRole } from "../../domain/types";
import { createId } from "../create-id";
import { racetrackOpeningCents } from "./manage-racetracks";
import { carriedOpeningCents } from "./summarize-month";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function monthName(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const name = MONTH_NAMES[month - 1];
  return name ? `${name} ${year}` : yearMonth;
}

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

function dayLabel(snapshot: LedgerSnapshot, day: { date: string; racetrackId: string; terminalId?: string }): string {
  const terminal = day.terminalId ? ` en Terminal ${day.terminalId}` : "";
  return `${formatDay(day.date)} de ${trackName(snapshot, day.racetrackId)}${terminal}`;
}

function categoryName(snapshot: LedgerSnapshot, id: string): string {
  return expenseCategoryLabel(id, snapshot);
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
    const oldOpening = racetrackOpeningCents(before, id);
    const newOpening = racetrackOpeningCents(after, id);
    if (!old) {
      lines.push(
        newOpening === 0 || oldOpening === newOpening
          ? `Agregó el hipódromo ${track.name}.`
          : `Agregó el hipódromo ${track.name} con saldo inicial de ${formatCents(newOpening)}.`,
      );
      continue;
    }
    const clauses: string[] = [];
    if (oldOpening !== newOpening) {
      clauses.push(`El saldo inicial pasó de ${formatCents(oldOpening)} a ${formatCents(newOpening)}.`);
    }
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
    if (old.profitShareBasisPoints !== track.profitShareBasisPoints) {
      clauses.push(
        track.profitShareBasisPoints === undefined
          ? "Pasó a porcentaje fijo."
          : old.profitShareBasisPoints === undefined
            ? `Pasó a descontado del depósito, con ${formatSignedPercent(track.profitShareBasisPoints)} de la ganancia.`
            : `La parte de la ganancia pasó de ${formatSignedPercent(old.profitShareBasisPoints)} a ${formatSignedPercent(track.profitShareBasisPoints)}.`,
      );
    }
    if (clauses.length === 1 && oldCommission !== newCommission && old.name === track.name && !adjustmentChanged && oldOpening === newOpening) {
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

function diffMonthOpenings(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const key = (opening: { month: string; racetrackId: string }) => `${opening.month}|${opening.racetrackId}`;
  const previous = new Map((before.monthOpenings ?? []).map((opening) => [key(opening), opening]));
  const next = new Map((after.monthOpenings ?? []).map((opening) => [key(opening), opening]));
  const present = new Set(listRacetracks(after).map((track) => track.id));
  for (const [id, opening] of next) {
    const old = previous.get(id);
    if (old && old.amountCents === opening.amountCents) {
      continue;
    }
    const carried = carriedOpeningCents(after, opening.month, opening.racetrackId);
    lines.push(
      `Anotó el saldo al empezar ${monthName(opening.month)} con ${trackName(after, opening.racetrackId)}: ${formatCents(opening.amountCents)} (venía ${formatCents(old ? old.amountCents : carried)}).`,
    );
  }
  for (const [id, opening] of previous) {
    if (next.has(id) || !present.has(opening.racetrackId)) {
      continue;
    }
    const carried = carriedOpeningCents(after, opening.month, opening.racetrackId);
    lines.push(
      `Volvió al saldo que venía al empezar ${monthName(opening.month)} con ${trackName(after, opening.racetrackId)}: ${formatCents(carried)}.`,
    );
  }
  return lines;
}

function diffCommissions(before: LedgerSnapshot, after: LedgerSnapshot, skip: ReadonlySet<string>): string[] {
  const lines: string[] = [];
  const previous = new Set(listRacetracks(before).map((track) => track.id));
  for (const { id } of listRacetracks(after)) {
    if (skip.has(id) || !previous.has(id)) {
      continue;
    }
    const oldCommission = currentCommissionBasisPoints(id, before.commissions, before);
    const newCommission = currentCommissionBasisPoints(id, after.commissions, after);
    if (oldCommission === newCommission) {
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
      lines.push(`Cargó el día ${dayLabel(after, day)}.`);
      continue;
    }
    const clauses: string[] = [];
    if (old.date !== day.date) {
      clauses.push(`La fecha pasó a ${formatDay(day.date)}.`);
    }
    if (old.racetrackId !== day.racetrackId) {
      clauses.push(`El hipódromo pasó a ${trackName(after, day.racetrackId)}.`);
    }
    if (old.terminalId !== day.terminalId && day.terminalId) {
      clauses.push(`La terminal pasó a Terminal ${day.terminalId}.`);
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
      lines.push(`Editó el día ${dayLabel(before, old)}. ${clauses.join(" ")}`);
    }
  }
  for (const [id, day] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el día ${dayLabel(before, day)}.`);
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

/** Lines an operator may read, and lines only the owner may read. */
type SplitLines = { shared: string[]; ownerOnly: string[] };

function diffExpenses(before: LedgerSnapshot, after: LedgerSnapshot): SplitLines {
  const shared: string[] = [];
  const ownerOnly: string[] = [];
  const previous = new Map(before.expenses.map((expense) => [expense.id, expense]));
  const next = new Map(after.expenses.map((expense) => [expense.id, expense]));
  for (const [id, expense] of next) {
    const old = previous.get(id);
    if (!old) {
      (expense.kind === "agency" ? shared : ownerOnly).push(
        `Cargó un gasto de ${formatCents(expense.amountCents)} en ${categoryName(after, expense.categoryId)}.`,
      );
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
      // Moving between public and owner-only mentions the private side: it stays with the owner.
      (old.kind === "agency" && expense.kind === "agency" ? shared : ownerOnly).push(
        `Editó un gasto de ${categoryName(before, old.categoryId)}. ${clauses.join(" ")}`,
      );
    }
  }
  for (const [id, expense] of previous) {
    if (!next.has(id)) {
      (expense.kind === "agency" ? shared : ownerOnly).push(`Quitó un gasto de ${categoryName(before, expense.categoryId)}.`);
    }
  }
  return { shared, ownerOnly };
}

function diffCategories(before: LedgerSnapshot, after: LedgerSnapshot): SplitLines {
  const shared: string[] = [];
  const ownerOnly: string[] = [];
  const previous = new Map(listExpenseCategories(before).map((category) => [category.id, category]));
  const next = new Map(listExpenseCategories(after).map((category) => [category.id, category]));
  for (const [id, category] of next) {
    const old = previous.get(id);
    if (!old) {
      (category.kind === "agency" ? shared : ownerOnly).push(`Agregó la categoría ${category.label}.`);
    } else if (old.label !== category.label) {
      (category.kind === "agency" ? shared : ownerOnly).push(`Renombró la categoría ${old.label} a ${category.label}.`);
    }
  }
  for (const [id, category] of previous) {
    if (!next.has(id)) {
      (category.kind === "agency" ? shared : ownerOnly).push(`Quitó la categoría ${category.label}.`);
    }
  }
  return { shared, ownerOnly };
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

function incomePhrase(income: CashIncome): string {
  return `${formatCents(income.amountCents)} en ${incomeKindLabel(income.kind).toLocaleLowerCase("es")}`;
}

function diffCash(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.cashDays ?? []).map((day) => [day.id, day]));
  const next = new Map((after.cashDays ?? []).map((day) => [day.id, day]));
  for (const [id, day] of next) {
    const old = previous.get(id);
    const oldIncomes = new Map((old?.incomes ?? []).map((income) => [income.id, income]));
    const newIncomes = new Map(day.incomes.map((income) => [income.id, income]));
    for (const [incomeId, income] of newIncomes) {
      const prior = oldIncomes.get(incomeId);
      if (!prior) {
        lines.push(`Ingresó ${incomePhrase(income)} en la caja del ${formatDay(day.date)}.`);
        continue;
      }
      if (prior.kind !== income.kind || prior.detail !== income.detail || prior.amountCents !== income.amountCents) {
        lines.push(`Cambió un ingreso de ${incomePhrase(prior)} a ${incomePhrase(income)} en la caja del ${formatDay(day.date)}.`);
      }
    }
    for (const [incomeId, income] of oldIncomes) {
      if (!newIncomes.has(incomeId)) {
        lines.push(`Quitó un ingreso de ${incomePhrase(income)} de la caja del ${formatDay(day.date)}.`);
      }
    }
    if (!old) {
      lines.push(`Guardó la caja del ${formatDay(day.date)}.`);
      continue;
    }
    const manualChanged =
      old.openingCents !== day.openingCents ||
      old.commissionCents !== day.commissionCents ||
      old.otherSalesCents !== day.otherSalesCents ||
      old.salesTaxCents !== day.salesTaxCents ||
      old.otherPaymentsCents !== day.otherPaymentsCents ||
      old.bankOutCents !== day.bankOutCents ||
      old.personalWithdrawalCents !== day.personalWithdrawalCents ||
      old.countedCents !== day.countedCents ||
      old.expenses.length !== day.expenses.length;
    if (manualChanged) {
      lines.push(`Editó la caja del ${formatDay(day.date)}.`);
    }
  }
  for (const [id, day] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó la caja del ${formatDay(day.date)}.`);
    }
  }
  return lines;
}

function diffStaff(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.staff ?? []).map((person) => [person.id, person]));
  const next = new Map((after.staff ?? []).map((person) => [person.id, person]));
  for (const [id, person] of next) {
    if (!previous.has(id)) {
      lines.push(`Agregó a ${person.name} sin cuenta.`);
    }
  }
  for (const [id, person] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó a ${person.name} sin cuenta.`);
    }
  }
  return lines;
}

function diffSchedule(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
  const lines: string[] = [];
  const previous = new Map((before.schedule ?? []).map((day) => [day.id, day]));
  const next = new Map((after.schedule ?? []).map((day) => [day.id, day]));
  for (const [id, day] of next) {
    const old = previous.get(id);
    const label = day.inactive
      ? "Sin actividad"
      : [...day.racetrackIds.map((trackId) => trackName(after, trackId)), ...day.people.map((person) => person.name)]
          .filter(Boolean)
          .join(", ");
    if (!old) {
      lines.push(`Armó el ${formatDay(day.date)}: ${label}.`);
      continue;
    }
    const same =
      old.inactive === day.inactive &&
      old.racetrackIds.join() === day.racetrackIds.join() &&
      old.people.map((person) => person.id).join() === day.people.map((person) => person.id).join();
    if (!same) {
      lines.push(`Cambió el ${formatDay(day.date)}: ${label}.`);
    }
  }
  for (const [id, day] of previous) {
    if (!next.has(id)) {
      lines.push(`Quitó el ${formatDay(day.date)} del calendario.`);
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

function changeLines(before: LedgerSnapshot, after: LedgerSnapshot): SplitLines {
  const startedBook =
    before.startingBalances?.status !== "done" && after.startingBalances?.status === "done"
      ? ["Cargó el estado de cuenta inicial."]
      : [];
  const racetracks = diffRacetracks(before, after);
  const expenses = diffExpenses(before, after);
  const categories = diffCategories(before, after);
  const shared = [
    ...startedBook,
    ...racetracks.lines,
    ...diffCommissions(before, after, racetracks.editedIds),
    ...diffMonthOpenings(before, after),
    ...diffDays(before, after),
    ...diffDeposits(before, after),
    ...expenses.shared,
    ...categories.shared,
    ...diffBettors(before, after),
    ...diffPlays(before, after),
    ...diffPayments(before, after),
    ...diffCash(before, after),
    ...diffStaff(before, after),
    ...diffSchedule(before, after),
  ];
  return { shared, ownerOnly: [...expenses.ownerOnly, ...categories.ownerOnly] };
}

export function describeLedgerChange(before: LedgerSnapshot, after: LedgerSnapshot): string | null {
  const { shared, ownerOnly } = changeLines(before, after);
  const lines = [...shared, ...ownerOnly];
  return lines.length === 0 ? null : lines.join(" ");
}

function namedActor(actorName?: string): { actorName: string } | Record<string, never> {
  const name = actorName?.trim();
  return name ? { actorName: name } : {};
}

export function withAuditEntry(
  before: LedgerSnapshot,
  after: LedgerSnapshot,
  actor: ViewerRole,
  at: string,
  actorName?: string,
): LedgerSnapshot {
  const { shared, ownerOnly } = changeLines(before, after);
  const entries: AuditEntry[] = [];
  if (shared.length > 0) {
    entries.push({ id: createId("audit"), at, actor, summary: shared.join(" "), ...namedActor(actorName) });
  }
  if (ownerOnly.length > 0) {
    entries.push({ id: createId("audit"), at, actor, summary: ownerOnly.join(" "), ownerOnly: true, ...namedActor(actorName) });
  }
  return entries.length === 0 ? after : { ...after, audit: [...(after.audit ?? []), ...entries] };
}

export function withRestoreAudit(snapshot: LedgerSnapshot, actor: ViewerRole, at: string, actorName?: string): LedgerSnapshot {
  const entry: AuditEntry = {
    id: createId("audit"),
    at,
    actor,
    summary: "Volvió a los datos de agosto.",
    ...namedActor(actorName),
  };
  return { ...snapshot, audit: [entry] };
}
