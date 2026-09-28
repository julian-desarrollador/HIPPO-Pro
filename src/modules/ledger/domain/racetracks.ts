import { LedgerError } from "./errors";
import type { RacetrackId } from "./types";

export type RacetrackRule = {
  id: RacetrackId;
  name: string;
  commissionBasisPoints: number;
  /**
   * Sign is the rule. Negative subtracts from the amount owed to the racetrack.
   * The 5% and 1% rates are still unconfirmed with Federico.
   */
  depositAdjustmentBasisPoints: number;
};

export const RACETRACKS: readonly RacetrackRule[] = [
  {
    id: "san-isidro",
    name: "San Isidro",
    commissionBasisPoints: 1500,
    depositAdjustmentBasisPoints: -500,
  },
  {
    id: "palermo",
    name: "Palermo",
    commissionBasisPoints: 900,
    depositAdjustmentBasisPoints: 100,
  },
  {
    id: "la-plata",
    name: "La Plata",
    commissionBasisPoints: 1500,
    depositAdjustmentBasisPoints: -500,
  },
];

export function getRacetrack(id: string): RacetrackRule {
  const found = RACETRACKS.find((racetrack) => racetrack.id === id);
  if (!found) {
    throw new LedgerError("unknown-racetrack");
  }
  return found;
}
