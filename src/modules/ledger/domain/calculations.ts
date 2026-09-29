import { getRacetrack } from "./racetracks";
import { applyBasisPoints, type Cents } from "./money";
import type { RacetrackId } from "./types";

export type DaySettlement = {
  netCents: Cents;
  commissionCents: Cents;
  adjustmentCents: Cents;
  amountToDepositCents: Cents;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
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
    adjustmentCents,
    amountToDepositCents: netCents - input.paidCents + adjustmentCents,
    commissionBasisPoints: rule.commissionBasisPoints,
    depositAdjustmentBasisPoints: rule.depositAdjustmentBasisPoints,
  };
}
