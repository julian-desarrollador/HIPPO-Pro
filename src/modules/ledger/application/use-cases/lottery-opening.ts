import { LedgerError } from "../../domain/errors";
import type { LotterySnapshot } from "../../domain/lottery";
import type { Cents } from "../../domain/money";
import type { ViewerRole } from "../../domain/types";
import type { LotteryRepository } from "../ports/lottery-repository";
import { requireLottery } from "./lottery-activate";
import { assertStartMonth, type StartingBalancesStep } from "./start-book";

export function lotteryStartingStep(
  snapshot: Pick<LotterySnapshot, "startingBalances" | "sales" | "deposits">,
): StartingBalancesStep {
  if (snapshot.startingBalances?.status === "done") {
    return null;
  }
  if (snapshot.sales.length > 0 || snapshot.deposits.length > 0) {
    return null;
  }
  return snapshot.startingBalances?.status === "later" ? "reminder" : "welcome";
}

export type SetLotteryOpeningInput = {
  role: ViewerRole;
  /** Positive: the agency owes the lottery. Negative: the lottery owes the agency. No commission. */
  openingCents: Cents;
  /** Only in the welcome: first month the agency will load. Missing keeps the current one. */
  startMonth?: string;
  at: string;
};

export function setLotteryOpening(repository: LotteryRepository, input: SetLotteryOpeningInput): void {
  if (input.role !== "owner") {
    throw new LedgerError("lottery-owner-only");
  }
  if (!Number.isSafeInteger(input.openingCents)) {
    throw new LedgerError("invalid-amount");
  }
  const snapshot = requireLottery(repository);
  if (input.startMonth !== undefined) {
    assertStartMonth(input.startMonth, snapshot.month);
  }
  repository.save({
    ...snapshot,
    month: input.startMonth ?? snapshot.month,
    openingCents: input.openingCents,
    startingBalances: snapshot.startingBalances?.status === "done" ? snapshot.startingBalances : { status: "done", at: input.at },
  });
}

export function postponeLotteryOpening(repository: LotteryRepository, input: { role: ViewerRole; at: string }): void {
  if (input.role !== "owner") {
    throw new LedgerError("lottery-owner-only");
  }
  const snapshot = requireLottery(repository);
  if (snapshot.startingBalances?.status === "done") {
    return;
  }
  repository.save({ ...snapshot, startingBalances: { status: "later", at: input.at } });
}
