import { LedgerError } from "../../domain/errors";
import { isBuiltinRacetrack, listRacetracks, RACETRACKS, racetrackHasMovements, racetrackIdFromName } from "../../domain/racetracks";
import type { AgencyRacetrack, RacetrackCommission } from "../../domain/types";
import { assertAdjustmentBasisPoints, assertCommissionBasisPoints } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddRacetrackInput = {
  name: string;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
};

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
  const duplicate =
    isBuiltinRacetrack(id) ||
    RACETRACKS.some((racetrack) => comparableName(racetrack.name) === comparableName(name)) ||
    existing.some((racetrack) => racetrack.id === id || comparableName(racetrack.name) === comparableName(name));
  if (duplicate) {
    throw new LedgerError("duplicate-racetrack");
  }

  const racetrack: AgencyRacetrack = {
    id,
    name,
    commissionBasisPoints: input.commissionBasisPoints,
    depositAdjustmentBasisPoints: input.depositAdjustmentBasisPoints,
  };
  repository.save({ ...snapshot, racetracks: [...(snapshot.racetracks ?? []), racetrack] });
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
    hiddenRacetrackIds,
  });
}
