import type { LotteryMonthSummary } from "./lottery-summary";
import type { Cents } from "../../domain/money";

/** One row of the ticket. Hípica is a game of the ticket, not the sum of the racetracks. */
export type AgencyProductLine = {
  id: string;
  name: string;
  commissionBasisPoints: number | null;
  soldCents: Cents;
  prizesCents: Cents;
  cancelledCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

/** Lottery games plus hípica, read as one account owed to the lottery. */
export type AgencyAccount = {
  products: AgencyProductLine[];
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
  owedCents: Cents;
  agencyExpenseCents: Cents;
  partnerWithdrawalCents: Cents;
  outflowCents: Cents;
  balanceCents: Cents;
};

/** The lottery month, in ticket order. The racetrack book stays out, so hípica is not counted twice. */
export function summarizeAgencyAccount(lottery: LotteryMonthSummary): AgencyAccount {
  const products: AgencyProductLine[] = lottery.games.map((game) => ({
    id: game.gameId,
    name: game.name,
    commissionBasisPoints: game.commissionBasisPoints,
    soldCents: game.soldCents,
    prizesCents: game.prizesCents,
    cancelledCents: game.cancelledCents,
    commissionCents: game.commissionCents,
    amountToDepositCents: game.amountToDepositCents,
  }));

  return {
    products,
    netCents: lottery.soldCents,
    commissionCents: lottery.commissionCents,
    amountToDepositCents: lottery.amountToDepositCents,
    owedCents: lottery.owedCents,
    agencyExpenseCents: lottery.agencyExpenseCents,
    partnerWithdrawalCents: lottery.partnerWithdrawalCents,
    outflowCents: lottery.outflowCents,
    balanceCents: lottery.balanceCents,
  };
}
