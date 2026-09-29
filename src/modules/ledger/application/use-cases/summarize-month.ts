import { settleDay } from "../../domain/calculations";
import { RACETRACKS, getRacetrack } from "../../domain/racetracks";
import type { Cents } from "../../domain/money";
import type { DailySale, LedgerSnapshot, RacetrackId } from "../../domain/types";

export type SettledDay = DailySale & {
  racetrackName: string;
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export function listSettledDays(snapshot: LedgerSnapshot, month = snapshot.month): SettledDay[] {
  return snapshot.days
    .filter((day) => day.agencyId === snapshot.agencyId && day.date.startsWith(month))
    .map((day) => ({
      ...day,
      racetrackName: getRacetrack(day.racetrackId).name,
      ...settleDay({
        racetrackId: day.racetrackId,
        soldCents: day.soldCents,
        cancelledCents: day.cancelledCents,
        paidCents: day.paidCents,
        commissionBasisPoints: day.commissionBasisPoints,
      }),
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.racetrackId.localeCompare(right.racetrackId));
}

export type RacetrackMonth = {
  racetrackId: RacetrackId;
  name: string;
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
  depositsCents: Cents;
  openingCents: Cents;
  owedCents: Cents;
};

export type MonthSummary = {
  agencyId: string;
  month: string;
  racetracks: RacetrackMonth[];
  billingCents: Cents;
  agencyExpenseCents: Cents;
  partnerWithdrawalCents: Cents;
  outflowCents: Cents;
  balanceCents: Cents;
};

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function storedOpening(snapshot: LedgerSnapshot, racetrackId: RacetrackId): Cents {
  return snapshot.openingBalances
    .filter((opening) => opening.racetrackId === racetrackId)
    .reduce((total, opening) => total + opening.amountCents, 0);
}

function movementCents(snapshot: LedgerSnapshot, month: string, racetrackId: RacetrackId): Cents {
  const generated = snapshot.days
    .filter((day) => day.agencyId === snapshot.agencyId && day.racetrackId === racetrackId && day.date.startsWith(month))
    .reduce(
      (total, day) =>
        total +
        settleDay({
          racetrackId: day.racetrackId,
          soldCents: day.soldCents,
          cancelledCents: day.cancelledCents,
          paidCents: day.paidCents,
          commissionBasisPoints: day.commissionBasisPoints,
        }).amountToDepositCents,
      0,
    );
  const deposited = snapshot.deposits
    .filter(
      (deposit) =>
        deposit.agencyId === snapshot.agencyId && deposit.racetrackId === racetrackId && deposit.date.startsWith(month),
    )
    .reduce((total, deposit) => total + deposit.amountCents, 0);
  return generated - deposited;
}

function openingCents(snapshot: LedgerSnapshot, month: string, racetrackId: RacetrackId): Cents {
  if (month < snapshot.month) {
    return 0;
  }
  let cursor = snapshot.month;
  let carried = storedOpening(snapshot, racetrackId);
  let guard = 0;
  while (cursor < month && guard < 240) {
    carried += movementCents(snapshot, cursor, racetrackId);
    cursor = nextMonth(cursor);
    guard += 1;
  }
  return carried;
}

export function summarizeMonth(snapshot: LedgerSnapshot, month = snapshot.month): MonthSummary {
  const days = listSettledDays(snapshot, month);
  const racetracks = RACETRACKS.map((rule) => {
    const racetrackId = rule.id;
    const trackDays = days.filter((day) => day.racetrackId === racetrackId);
    const netCents = trackDays.reduce((total, day) => total + day.netCents, 0);
    const commissionCents = trackDays.reduce((total, day) => total + day.commissionCents, 0);
    const amountToDepositCents = trackDays.reduce((total, day) => total + day.amountToDepositCents, 0);
    const depositsCents = snapshot.deposits
      .filter(
        (deposit) =>
          deposit.agencyId === snapshot.agencyId &&
          deposit.racetrackId === racetrackId &&
          deposit.date.startsWith(month),
      )
      .reduce((total, deposit) => total + deposit.amountCents, 0);
    const carriedOpening = openingCents(snapshot, month, racetrackId);

    return {
      racetrackId,
      name: rule.name,
      netCents,
      commissionCents,
      amountToDepositCents,
      depositsCents,
      openingCents: carriedOpening,
      owedCents: carriedOpening + amountToDepositCents - depositsCents,
    };
  });

  const billingCents = racetracks.reduce((total, track) => total + track.commissionCents, 0);
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
    racetracks,
    billingCents,
    agencyExpenseCents,
    partnerWithdrawalCents,
    outflowCents,
    balanceCents: billingCents - outflowCents,
  };
}
