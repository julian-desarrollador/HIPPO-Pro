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

export function listSettledDays(snapshot: LedgerSnapshot): SettledDay[] {
  return snapshot.days
    .filter((day) => day.agencyId === snapshot.agencyId && day.date.startsWith(snapshot.month))
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

export function summarizeMonth(snapshot: LedgerSnapshot): MonthSummary {
  const days = listSettledDays(snapshot);
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
          deposit.date.startsWith(snapshot.month),
      )
      .reduce((total, deposit) => total + deposit.amountCents, 0);
    const openingCents = snapshot.openingBalances
      .filter((opening) => opening.racetrackId === racetrackId)
      .reduce((total, opening) => total + opening.amountCents, 0);

    return {
      racetrackId,
      name: rule.name,
      netCents,
      commissionCents,
      amountToDepositCents,
      depositsCents,
      openingCents,
      owedCents: openingCents + amountToDepositCents - depositsCents,
    };
  });

  const billingCents = racetracks.reduce((total, track) => total + track.commissionCents, 0);
  const monthExpenses = snapshot.expenses.filter(
    (expense) => expense.agencyId === snapshot.agencyId && expense.month === snapshot.month,
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
    month: snapshot.month,
    racetracks,
    billingCents,
    agencyExpenseCents,
    partnerWithdrawalCents,
    outflowCents,
    balanceCents: billingCents - outflowCents,
  };
}
