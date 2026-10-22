import { getLotteryGame } from "../../domain/lottery";
import { assertCommissionBasisPoints } from "../../domain/validation";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";

export type UpdateLotteryCommissionInput = {
  gameId: string;
  commissionBasisPoints: number;
};

/** Applies to days recorded afterwards. Loaded sales keep their copy. */
export function updateLotteryCommission(repository: LotteryRepository, input: UpdateLotteryCommissionInput): void {
  const snapshot = requireLottery(repository);
  getLotteryGame(snapshot, input.gameId);
  assertCommissionBasisPoints(input.commissionBasisPoints);
  repository.save({
    ...snapshot,
    games: snapshot.games.map((game) =>
      game.id === input.gameId ? { ...game, commissionBasisPoints: input.commissionBasisPoints } : game,
    ),
  });
}
