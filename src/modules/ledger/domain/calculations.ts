import { LedgerError } from "./errors";
import { applyBasisPoints, type Cents } from "./money";
import { RACETRACKS } from "./racetracks";
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
  commissionBasisPoints?: number;
  depositAdjustmentBasisPoints?: number;
}): DaySettlement {
  const builtin = RACETRACKS.find((racetrack) => racetrack.id === input.racetrackId);
  const commissionBasisPoints = input.commissionBasisPoints ?? builtin?.commissionBasisPoints;
  const depositAdjustmentBasisPoints = input.depositAdjustmentBasisPoints ?? builtin?.depositAdjustmentBasisPoints;
  if (commissionBasisPoints === undefined || depositAdjustmentBasisPoints === undefined) {
    throw new LedgerError("unknown-racetrack");
  }
  const netCents = input.soldCents - input.cancelledCents;
  const commissionCents = applyBasisPoints(netCents, commissionBasisPoints);
  const adjustmentCents = applyBasisPoints(netCents, depositAdjustmentBasisPoints);

  return {
    netCents,
    commissionCents,
    adjustmentCents,
    amountToDepositCents: netCents - input.paidCents + adjustmentCents,
    commissionBasisPoints,
    depositAdjustmentBasisPoints,
  };
}
