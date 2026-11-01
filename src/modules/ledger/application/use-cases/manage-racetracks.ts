import { LedgerError } from "../../domain/errors";
import { isBuiltinRacetrack, listRacetracks, RACETRACKS, racetrackHasMovements, racetrackIdFromName } from "../../domain/racetracks";
import type { Cents } from "../../domain/money";
import type { AgencyRacetrack, LedgerSnapshot, OpeningBalance, RacetrackCommission } from "../../domain/types";
import { assertAdjustmentBasisPoints, assertCommissionBasisPoints } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddRacetrackInput = {
  name: string;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
  /**
   * What was owed to the racetrack when the agency started the book, at the start of
   * snapshot.month. Positive: the agency owes. Negative: the racetrack owes. It carries
   * no commission. Missing keeps the stored value.
   */
  openingCents?: Cents;
};

/** The starting balance with a racetrack, at the start of the book's first month. */
export function racetrackOpeningCents(snapshot: Pick<LedgerSnapshot, "openingBalances">, racetrackId: string): Cents {
  return snapshot.openingBalances
    .filter((opening) => opening.racetrackId === racetrackId)
    .reduce((total, opening) => total + opening.amountCents, 0);
}

export function withOpening(
  openingBalances: readonly OpeningBalance[],
  racetrackId: string,
  openingCents: Cents | undefined,
): OpeningBalance[] {
  if (openingCents === undefined) {
    return openingBalances.slice();
  }
  if (!Number.isSafeInteger(openingCents)) {
    throw new LedgerError("invalid-amount");
  }
  const others = openingBalances.filter((opening) => opening.racetrackId !== racetrackId);
  return openingCents === 0 ? others : [...others, { racetrackId, amountCents: openingCents }];
}

function comparableName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function normalizedName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || !racetrackIdFromName(name)) {
    throw new LedgerError("invalid-name");
  }
  return name;
}

export function addRacetrack(repository: LedgerRepository, input: AddRacetrackInput): AgencyRacetrack {
  const snapshot = repository.load();
  const name = normalizedName(input.name);
  const id = racetrackIdFromName(name);
  assertCommissionBasisPoints(input.commissionBasisPoints);
  assertAdjustmentBasisPoints(input.depositAdjustmentBasisPoints);

  const existing = listRacetracks(snapshot);
  if (existing.some((racetrack) => racetrack.id === id || comparableName(racetrack.name) === comparableName(name))) {
    throw new LedgerError("duplicate-racetrack");
  }

  const hidden = new Set(snapshot.hiddenRacetrackIds ?? []);
  const hiddenBuiltin = RACETRACKS.find(
    (racetrack) => hidden.has(racetrack.id) && (racetrack.id === id || comparableName(racetrack.name) === comparableName(name)),
  );
  if (hiddenBuiltin) {
    const restored: AgencyRacetrack = {
      id: hiddenBuiltin.id,
      name,
      commissionBasisPoints: input.commissionBasisPoints,
      depositAdjustmentBasisPoints: input.depositAdjustmentBasisPoints,
    };
    repository.save({
      ...snapshot,
      racetracks: [...(snapshot.racetracks ?? []).filter((racetrack) => racetrack.id !== hiddenBuiltin.id), restored],
      commissions: withCommission(snapshot.commissions, hiddenBuiltin.id, input.commissionBasisPoints),
      hiddenRacetrackIds: (snapshot.hiddenRacetrackIds ?? []).filter((hiddenId) => hiddenId !== hiddenBuiltin.id),
      openingBalances: withOpening(snapshot.openingBalances, hiddenBuiltin.id, input.openingCents),
    });
    return restored;
  }

  if (isBuiltinRacetrack(id) || RACETRACKS.some((racetrack) => comparableName(racetrack.name) === comparableName(name))) {
    throw new LedgerError("duplicate-racetrack");
  }

  const racetrack: AgencyRacetrack = {
    id,
    name,
    commissionBasisPoints: input.commissionBasisPoints,
    depositAdjustmentBasisPoints: input.depositAdjustmentBasisPoints,
  };
  repository.save({
    ...snapshot,
    racetracks: [...(snapshot.racetracks ?? []), racetrack],
    openingBalances: withOpening(snapshot.openingBalances, id, input.openingCents),
  });
  return racetrack;
}

export type UpdateRacetrackInput = AddRacetrackInput & { id: string };

function withCommission(
  commissions: readonly RacetrackCommission[] | undefined,
  racetrackId: string,
  commissionBasisPoints: number,
): RacetrackCommission[] {
  const next = (commissions ?? []).slice();
  const index = next.findIndex((item) => item.racetrackId === racetrackId);
  const entry = { racetrackId, commissionBasisPoints };
  if (index === -1) {
    next.push(entry);
  } else {
    next[index] = entry;
  }
  return next;
}

export function updateRacetrack(repository: LedgerRepository, input: UpdateRacetrackInput): AgencyRacetrack {
  const snapshot = repository.load();
  if (!listRacetracks(snapshot).some((racetrack) => racetrack.id === input.id)) {
    throw new LedgerError("unknown-racetrack");
  }

  const name = normalizedName(input.name);
  assertCommissionBasisPoints(input.commissionBasisPoints);
  assertAdjustmentBasisPoints(input.depositAdjustmentBasisPoints);

  const duplicate = listRacetracks(snapshot).some(
    (racetrack) => racetrack.id !== input.id && comparableName(racetrack.name) === comparableName(name),
  );
  if (duplicate) {
    throw new LedgerError("duplicate-racetrack");
  }

  const racetrack: AgencyRacetrack = {
    id: input.id,
    name,
    commissionBasisPoints: input.commissionBasisPoints,
    depositAdjustmentBasisPoints: input.depositAdjustmentBasisPoints,
  };
  const current = snapshot.racetracks ?? [];
  const index = current.findIndex((item) => item.id === input.id);
  const racetracks = current.slice();
  if (index === -1) {
    racetracks.push(racetrack);
  } else {
    racetracks[index] = racetrack;
  }

  repository.save({
    ...snapshot,
    racetracks,
    commissions: withCommission(snapshot.commissions, input.id, input.commissionBasisPoints),
    openingBalances: withOpening(snapshot.openingBalances, input.id, input.openingCents),
  });
  return racetrack;
}

export function removeRacetrack(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  if (!listRacetracks(snapshot).some((racetrack) => racetrack.id === id)) {
    throw new LedgerError("unknown-racetrack");
  }
  if (racetrackHasMovements(snapshot, id)) {
    throw new LedgerError("racetrack-in-use");
  }

  const hiddenRacetrackIds = isBuiltinRacetrack(id)
    ? [...(snapshot.hiddenRacetrackIds ?? []), id]
    : snapshot.hiddenRacetrackIds;

  repository.save({
    ...snapshot,
    racetracks: (snapshot.racetracks ?? []).filter((racetrack) => racetrack.id !== id),
    commissions: snapshot.commissions?.filter((item) => item.racetrackId !== id),
    openingBalances: snapshot.openingBalances.filter((opening) => opening.racetrackId !== id),
    monthOpenings: snapshot.monthOpenings?.filter((opening) => opening.racetrackId !== id),
    hiddenRacetrackIds,
  });
}
