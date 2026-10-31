import { LedgerError } from "../../domain/errors";
import type { Cents } from "../../domain/money";
import { listRacetracks } from "../../domain/racetracks";
import type { LedgerSnapshot } from "../../domain/types";
import { assertYearMonth } from "../../domain/validation";
import type { LedgerRepository } from "../ports/ledger-repository";
import { addRacetrack } from "./manage-racetracks";

/**
 * "welcome": a new book, nothing loaded and no answer yet.
 * "reminder": the owner chose "Hacerlo luego".
 * null: the starting balances are in, or the book already has racetracks or movements.
 */
export type StartingBalancesStep = "welcome" | "reminder" | null;

export function racingStartingStep(
  snapshot: Pick<LedgerSnapshot, "startingBalances" | "days" | "deposits" | "racetracks" | "hiddenRacetrackIds">,
): StartingBalancesStep {
  if (snapshot.startingBalances?.status === "done") {
    return null;
  }
  if (snapshot.days.length > 0 || snapshot.deposits.length > 0 || listRacetracks(snapshot).length > 0) {
    return null;
  }
  return snapshot.startingBalances?.status === "later" ? "reminder" : "welcome";
}

export type StartingRacetrackInput = {
  name: string;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
  /** Positive: the agency owes the racetrack. Negative: the racetrack owes the agency. No commission. */
  openingCents: Cents;
};

export type StartRacingBookInput = {
  racetracks: readonly StartingRacetrackInput[];
  /** First month the agency will load. The starting balances are the ones at its first day. */
  startMonth: string;
  at: string;
};

/** The account can start in the month the book was opened or earlier, to load past paper records. */
export function assertStartMonth(startMonth: string, openedMonth: string): void {
  assertYearMonth(startMonth);
  if (startMonth > openedMonth) {
    throw new LedgerError("invalid-start-month");
  }
}

/** Adds every racetrack with its starting balance in one save. If one is wrong, nothing is saved. */
export function startRacingBook(repository: LedgerRepository, input: StartRacingBookInput): void {
  if (input.racetracks.length === 0) {
    throw new LedgerError("no-starting-racetrack");
  }
  let draft = repository.load();
  assertStartMonth(input.startMonth, draft.month);
  const staging: LedgerRepository = {
    load: () => draft,
    save: (snapshot) => {
      draft = snapshot;
    },
    reset: () => {
      draft = repository.load();
    },
  };
  for (const racetrack of input.racetracks) {
    addRacetrack(staging, racetrack);
  }
  repository.save({ ...draft, month: input.startMonth, startingBalances: { status: "done", at: input.at } });
}

export function postponeStartingBalances(repository: LedgerRepository, at: string): void {
  const snapshot = repository.load();
  if (snapshot.startingBalances?.status === "done") {
    return;
  }
  repository.save({ ...snapshot, startingBalances: { status: "later", at } });
}

/** Total owed to the racetracks when the account starts. Positive: the agency owes. */
export function sumStartingBalances(racetracks: readonly Pick<StartingRacetrackInput, "openingCents">[]): Cents {
  return racetracks.reduce((total, racetrack) => total + racetrack.openingCents, 0);
}
