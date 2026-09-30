import { bettorBalanceCents, bettorPlayAmounts, getBettor, listBettors } from "../../domain/bettor-account";
import { LedgerError } from "../../domain/errors";
import type { Cents } from "../../domain/money";
import type { LedgerSnapshot } from "../../domain/types";

export type BettorBalanceStatus = "owes" | "credit" | "even";

export type BettorMovement = {
  id: string;
  date: string;
  kind: "play" | "payment";
  kindLabel: string;
  /** Stake of a day. Absent on a payment. */
  stakeCents?: Cents;
  /** Dividend collected that day. Absent on a payment. */
  payoutCents?: Cents;
  /** Cash paid to the agency. Absent on a day. */
  amountCents?: Cents;
};

export type BettorAccount = {
  id: string;
  name: string;
  balanceCents: Cents;
  status: BettorBalanceStatus;
  statusLabel: "Debe" | "A favor" | "Al día";
  movements: BettorMovement[];
};

function statusFromBalance(balanceCents: Cents): { status: BettorBalanceStatus; statusLabel: BettorAccount["statusLabel"] } {
  if (balanceCents > 0) {
    return { status: "owes", statusLabel: "Debe" };
  }
  if (balanceCents < 0) {
    return { status: "credit", statusLabel: "A favor" };
  }
  return { status: "even", statusLabel: "Al día" };
}

export function listBettorAccounts(snapshot: LedgerSnapshot): BettorAccount[] {
  return listBettors(snapshot)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .map((bettor) => getBettorAccount(snapshot, bettor.id));
}

export function getBettorAccount(snapshot: LedgerSnapshot, id: string): BettorAccount {
  const bettor = getBettor(snapshot, id);
  const balanceCents = bettorBalanceCents(snapshot, id);
  const { status, statusLabel } = statusFromBalance(balanceCents);
  const plays = (snapshot.bettorPlays ?? [])
    .filter((play) => play.bettorId === id)
    .map((play) => {
      const amounts = bettorPlayAmounts(play);
      return {
        id: play.id,
        date: play.date,
        kind: "play" as const,
        kindLabel: "Día",
        stakeCents: amounts.stakeCents,
        payoutCents: amounts.payoutCents,
      };
    });
  const payments = (snapshot.bettorPayments ?? [])
    .filter((payment) => payment.bettorId === id)
    .map((payment) => ({
      id: payment.id,
      date: payment.date,
      kind: "payment" as const,
      kindLabel: "Pago",
      amountCents: payment.amountCents,
    }));
  const movements = [...plays, ...payments].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) {
      return byDate;
    }
    return left.id.localeCompare(right.id);
  });

  return {
    id: bettor.id,
    name: bettor.name,
    balanceCents,
    status,
    statusLabel,
    movements,
  };
}

export function findBettorAccount(snapshot: LedgerSnapshot, id: string): BettorAccount | null {
  try {
    return getBettorAccount(snapshot, id);
  } catch (error) {
    if (error instanceof LedgerError && error.code === "unknown-bettor") {
      return null;
    }
    throw error;
  }
}
