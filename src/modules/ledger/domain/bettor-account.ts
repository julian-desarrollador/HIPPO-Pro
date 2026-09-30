import { LedgerError } from "./errors";
import type { Cents } from "./money";
import type { Bettor, BettorPlay, LedgerSnapshot } from "./types";

/** Stake is debt. The dividend (payout, stake included) is credit. A legacy won row credited only its amount. */
export function bettorPlayAmounts(play: Pick<BettorPlay, "amountCents" | "payoutCents" | "outcome">): {
  stakeCents: Cents;
  payoutCents: Cents;
} {
  if (play.payoutCents !== undefined) {
    return { stakeCents: play.amountCents, payoutCents: play.payoutCents };
  }
  if (play.outcome === "won") {
    return { stakeCents: 0, payoutCents: play.amountCents };
  }
  return { stakeCents: play.amountCents, payoutCents: 0 };
}

export function listBettors(snapshot: Pick<LedgerSnapshot, "bettors">): readonly Bettor[] {
  return snapshot.bettors ?? [];
}

export function getBettor(snapshot: Pick<LedgerSnapshot, "bettors">, id: string): Bettor {
  const found = listBettors(snapshot).find((bettor) => bettor.id === id);
  if (!found) {
    throw new LedgerError("unknown-bettor");
  }
  return found;
}

export function bettorHasMovements(snapshot: Pick<LedgerSnapshot, "bettorPlays" | "bettorPayments">, id: string): boolean {
  const plays = snapshot.bettorPlays ?? [];
  const payments = snapshot.bettorPayments ?? [];
  return plays.some((play) => play.bettorId === id) || payments.some((payment) => payment.bettorId === id);
}

export function bettorBalanceCents(snapshot: Pick<LedgerSnapshot, "bettorPlays" | "bettorPayments">, bettorId: string): Cents {
  const plays = snapshot.bettorPlays ?? [];
  const payments = snapshot.bettorPayments ?? [];
  let balance = 0;
  for (const play of plays) {
    if (play.bettorId !== bettorId) {
      continue;
    }
    const { stakeCents, payoutCents } = bettorPlayAmounts(play);
    balance += stakeCents - payoutCents;
  }
  for (const payment of payments) {
    if (payment.bettorId === bettorId) {
      balance -= payment.amountCents;
    }
  }
  return balance;
}
