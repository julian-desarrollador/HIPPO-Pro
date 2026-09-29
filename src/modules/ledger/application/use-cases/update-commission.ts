import { RACETRACKS, getRacetrack } from "../../domain/racetracks";
import type { RacetrackCommission, RacetrackId } from "../../domain/types";
import { assertCommissionBasisPoints } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";

export type UpdateCommissionInput = {
  racetrackId: string;
  commissionBasisPoints: number;
};

export function updateCommission(repository: LedgerRepository, input: UpdateCommissionInput): RacetrackCommission {
  const snapshot = repository.load();
  const racetrack = getRacetrack(input.racetrackId);
  assertCommissionBasisPoints(input.commissionBasisPoints);

  const racetrackId = racetrack.id as RacetrackId;
  const commissions = RACETRACKS.map((rule) => {
    const stored = snapshot.commissions?.find((item) => item.racetrackId === rule.id);
    return {
      racetrackId: rule.id,
      commissionBasisPoints:
        rule.id === racetrackId
          ? input.commissionBasisPoints
          : (stored?.commissionBasisPoints ?? rule.commissionBasisPoints),
    };
  });

  repository.save({ ...snapshot, commissions });
  return { racetrackId, commissionBasisPoints: input.commissionBasisPoints };
}
