import { LedgerError } from "./errors";
import type { AgencyRacetrack, LedgerSnapshot, RacetrackCommission, RacetrackId } from "./types";

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

export type RacetrackCatalog = {
  racetracks?: readonly AgencyRacetrack[];
  hiddenRacetrackIds?: readonly string[];
};

function readRacetrackCatalog(source?: RacetrackCatalog | readonly AgencyRacetrack[]): {
  extras: readonly AgencyRacetrack[];
  hidden: ReadonlySet<string>;
} {
  if (!source) {
    return { extras: [], hidden: new Set() };
  }
  if (Array.isArray(source)) {
    return { extras: source, hidden: new Set() };
  }
  const catalog = source as RacetrackCatalog;
  return {
    extras: catalog.racetracks ?? [],
    hidden: new Set(catalog.hiddenRacetrackIds ?? []),
  };
}

export function listRacetracks(source?: RacetrackCatalog | readonly AgencyRacetrack[]): readonly RacetrackRule[] {
  const { extras, hidden } = readRacetrackCatalog(source);
  const overrides = new Map(extras.filter((racetrack) => isBuiltinRacetrack(racetrack.id)).map((racetrack) => [racetrack.id, racetrack]));
  const builtins = RACETRACKS.filter((racetrack) => !hidden.has(racetrack.id)).map((racetrack) => {
    const override = overrides.get(racetrack.id);
    if (!override) {
      return racetrack;
    }
    return {
      id: racetrack.id,
      name: override.name,
      commissionBasisPoints: override.commissionBasisPoints,
      depositAdjustmentBasisPoints: override.depositAdjustmentBasisPoints,
    };
  });
  const added = extras.filter((racetrack) => !isBuiltinRacetrack(racetrack.id) && !hidden.has(racetrack.id));
  return [...builtins, ...added];
}

export function isBuiltinRacetrack(id: string): boolean {
  return RACETRACKS.some((racetrack) => racetrack.id === id);
}

export function racetrackHasMovements(snapshot: Pick<LedgerSnapshot, "days" | "deposits">, id: string): boolean {
  return (
    snapshot.days.some((day) => day.racetrackId === id) || snapshot.deposits.some((deposit) => deposit.racetrackId === id)
  );
}

export function getRacetrack(id: string, source?: RacetrackCatalog | readonly AgencyRacetrack[]): RacetrackRule {
  const found = listRacetracks(source).find((racetrack) => racetrack.id === id);
  if (!found) {
    throw new LedgerError("unknown-racetrack");
  }
  return found;
}

export function racetrackIdFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function currentCommissionBasisPoints(
  racetrackId: RacetrackId,
  commissions: readonly RacetrackCommission[] | undefined,
  source?: RacetrackCatalog | readonly AgencyRacetrack[],
): number {
  const stored = Array.isArray(commissions)
    ? commissions.find((item) => item.racetrackId === racetrackId)
    : undefined;
  if (stored && Number.isInteger(stored.commissionBasisPoints)) {
    return stored.commissionBasisPoints;
  }
  return getRacetrack(racetrackId, source).commissionBasisPoints;
}
