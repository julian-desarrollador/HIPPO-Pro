import { LedgerError } from "./errors";
import { applyBasisPoints, type Cents } from "./money";
import { RACETRACKS } from "./racetracks";
import type { RacetrackId } from "./types";

export type DaySettlement = {
  netCents: Cents;
  /** Net minus what was paid to bettors: the cash the day left before the agency's share. */
  dayGainCents: Cents;
  /** Everything the agency earns on the day. In retained mode it is netShareCents + profitShareCents. */
  commissionCents: Cents;
  adjustmentCents: Cents;
  amountToDepositCents: Cents;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
  /** Retained mode only: the share of the day gain. Missing in fixed mode. */
  profitShareBasisPoints?: number;
  /** Retained mode: commissionBasisPoints of the net. Fixed mode: the whole commission. */
  netShareCents: Cents;
  /** Retained mode: day gain minus commissionBasisPoints of it, never below zero. Zero in fixed mode. */
  profitShareBaseCents: Cents;
  /** Retained mode: profitShareBasisPoints of the base. Zero in fixed mode. */
  profitShareCents: Cents;
};

/**
 * Fixed mode (the August rule): commission = net × commission; to deposit = net − paid + adjustment.
 *
 * Retained mode, when profitShareBasisPoints comes in (Federico's rule, November 2026):
 * the agency keeps commission × net, plus profitShare × (gain − commission × gain),
 * where gain = net − paid. A losing day adds nothing from the gain. To deposit = gain − what the agency keeps.
 * Example: net 1.000.000, paid 600.000, 6,75 % and 20 % → 67.500 + 20 % of 373.000 (74.600) = 142.100; deposit 257.900.
 */
export function settleDay(input: {
  racetrackId: RacetrackId;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
  commissionBasisPoints?: number;
  depositAdjustmentBasisPoints?: number;
  profitShareBasisPoints?: number;
}): DaySettlement {
  const builtin = RACETRACKS.find((racetrack) => racetrack.id === input.racetrackId);
  const commissionBasisPoints = input.commissionBasisPoints ?? builtin?.commissionBasisPoints;
  const netCents = input.soldCents - input.cancelledCents;
  const dayGainCents = netCents - input.paidCents;

  if (input.profitShareBasisPoints !== undefined) {
    if (commissionBasisPoints === undefined) {
      throw new LedgerError("unknown-racetrack");
    }
    const netShareCents = applyBasisPoints(netCents, commissionBasisPoints);
    const profitShareBaseCents = Math.max(0, dayGainCents - applyBasisPoints(dayGainCents, commissionBasisPoints));
    const profitShareCents = applyBasisPoints(profitShareBaseCents, input.profitShareBasisPoints);
    const commissionCents = netShareCents + profitShareCents;
    return {
      netCents,
      dayGainCents,
      commissionCents,
      adjustmentCents: 0,
      amountToDepositCents: dayGainCents - commissionCents,
      commissionBasisPoints,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: input.profitShareBasisPoints,
      netShareCents,
      profitShareBaseCents,
      profitShareCents,
    };
  }

  const depositAdjustmentBasisPoints = input.depositAdjustmentBasisPoints ?? builtin?.depositAdjustmentBasisPoints;
  if (commissionBasisPoints === undefined || depositAdjustmentBasisPoints === undefined) {
    throw new LedgerError("unknown-racetrack");
  }
  const commissionCents = applyBasisPoints(netCents, commissionBasisPoints);
  const adjustmentCents = applyBasisPoints(netCents, depositAdjustmentBasisPoints);

  return {
    netCents,
    dayGainCents,
    commissionCents,
    adjustmentCents,
    amountToDepositCents: dayGainCents + adjustmentCents,
    commissionBasisPoints,
    depositAdjustmentBasisPoints,
    netShareCents: commissionCents,
    profitShareBaseCents: 0,
    profitShareCents: 0,
  };
}
