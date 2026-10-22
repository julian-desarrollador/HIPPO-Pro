import { LedgerError } from "../../domain/errors";
import { LOTTERY_GAMES, type LotterySnapshot } from "../../domain/lottery";
import type { ViewerRole } from "../../domain/types";
import { assertYearMonth } from "../../domain/validation";
import { createId } from "../create-id";
import type { LotteryRepository } from "../ports/lottery-repository";

export type ActivateLotteryInput = {
  agencyId: string;
  role: ViewerRole;
  actorName: string;
  at: string;
  month: string;
};

export function requireLottery(repository: LotteryRepository): LotterySnapshot {
  const snapshot = repository.load();
  if (!snapshot) {
    throw new LedgerError("lottery-inactive");
  }
  return snapshot;
}

export function activateLottery(repository: LotteryRepository, input: ActivateLotteryInput): LotterySnapshot {
  if (input.role !== "owner") {
    throw new LedgerError("lottery-owner-only");
  }
  const existing = repository.load();
  if (existing) {
    return existing;
  }
  assertYearMonth(input.month);
  const actorName = input.actorName.trim();
  const snapshot: LotterySnapshot = {
    agencyId: input.agencyId,
    activatedAt: input.at,
    activatedBy: actorName,
    month: input.month,
    games: LOTTERY_GAMES.map((game) => ({ ...game })),
    sales: [],
    deposits: [],
    expenses: [],
    openingCents: 0,
    audit: [
      {
        id: createId("audit"),
        at: input.at,
        actor: input.role,
        summary: "Activó la quiniela.",
        ...(actorName ? { actorName } : {}),
      },
    ],
  };
  repository.save(snapshot);
  return snapshot;
}
