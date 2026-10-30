import type { Cents } from "../../domain/money";
import type { SettledDay } from "./summarize-month";

export type SettledDaysTotal = {
  soldCents: Cents;
  cancelledCents: Cents;
  netCents: Cents;
  paidCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export function totalSettledDays(days: readonly SettledDay[]): SettledDaysTotal {
  return days.reduce<SettledDaysTotal>(
    (total, day) => ({
      soldCents: total.soldCents + day.soldCents,
      cancelledCents: total.cancelledCents + day.cancelledCents,
      netCents: total.netCents + day.netCents,
      paidCents: total.paidCents + day.paidCents,
      commissionCents: total.commissionCents + day.commissionCents,
      amountToDepositCents: total.amountToDepositCents + day.amountToDepositCents,
    }),
    { soldCents: 0, cancelledCents: 0, netCents: 0, paidCents: 0, commissionCents: 0, amountToDepositCents: 0 },
  );
}

export function totalAmounts(rows: readonly { amountCents: Cents }[]): Cents {
  return rows.reduce((total, row) => total + row.amountCents, 0);
}
