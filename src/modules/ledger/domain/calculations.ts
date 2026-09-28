import { getRacetrack } from "./racetracks";
import { applyBasisPoints, type Cents } from "./money";
import type { RacetrackId } from "./types";

export type DaySettlement = {
  netCents: Cents;
  commissionCents: Cents;
  amountToDepositCents: Cents;
};

export function settleDay(input: {
  racetrackId: RacetrackId;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
}): DaySettlement {
  const rule = getRacetrack(input.racetrackId);
  const netCents = input.soldCents - input.cancelledCents;
  const commissionCents = applyBasisPoints(netCents, rule.commissionBasisPoints);
  const adjustmentCents = applyBasisPoints(netCents, rule.depositAdjustmentBasisPoints);

  return {
    netCents,
    commissionCents,
    amountToDepositCents: netCents - input.paidCents + adjustmentCents,
  };
}
