import { getRacetrack, listRacetracks } from "../../domain/racetracks";
import type { RacetrackCommission, RacetrackId } from "../../domain/types";
import { assertCommissionBasisPoints } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";

export type UpdateCommissionInput = {
  racetrackId: string;
  commissionBasisPoints: number;
};

export function updateCommission(repository: LedgerRepository, input: UpdateCommissionInput): RacetrackCommission {
  const snapshot = repository.load();
  const racetrack = getRacetrack(input.racetrackId, snapshot);
  assertCommissionBasisPoints(input.commissionBasisPoints);

  const racetrackId = racetrack.id as RacetrackId;
  const commissions = listRacetracks(snapshot).map((rule) => {
    const stored = snapshot.commissions?.find((item) => item.racetrackId === rule.id);
    return {
      racetrackId: rule.id,
      commissionBasisPoints:
        rule.id === racetrackId
          ? input.commissionBasisPoints
          : (stored?.commissionBasisPoints ?? rule.commissionBasisPoints),
    };
  });
  const racetracks = snapshot.racetracks?.map((item) =>
    item.id === racetrackId ? { ...item, commissionBasisPoints: input.commissionBasisPoints } : item,
  );

  repository.save({ ...snapshot, commissions, racetracks });
  return { racetrackId, commissionBasisPoints: input.commissionBasisPoints };
}
