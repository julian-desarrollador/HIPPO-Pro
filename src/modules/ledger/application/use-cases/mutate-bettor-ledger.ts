import { getBettor } from "../../domain/bettor-account";
import { LedgerError } from "../../domain/errors";
import type { BettorPayment, BettorPlay } from "../../domain/types";
import { assertCents, assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type RecordBettorPlayInput = {
  bettorId: string;
  date: string;
  amountCents: number;
  payoutCents: number;
};

export function recordBettorPlay(repository: LedgerRepository, input: RecordBettorPlayInput): BettorPlay {
  const snapshot = repository.load();
  const bettor = getBettor(snapshot, input.bettorId);
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });
  assertCents(input.payoutCents, { allowZero: true });

  const play: BettorPlay = {
    id: createId("play"),
    agencyId: snapshot.agencyId,
    bettorId: bettor.id,
    date: input.date,
    amountCents: input.amountCents,
    payoutCents: input.payoutCents,
  };
  repository.save({ ...snapshot, bettorPlays: [...(snapshot.bettorPlays ?? []), play] });
  return play;
}

export type UpdateBettorPlayInput = RecordBettorPlayInput & { id: string };

export function updateBettorPlay(repository: LedgerRepository, input: UpdateBettorPlayInput): BettorPlay {
  const snapshot = repository.load();
  const plays = snapshot.bettorPlays ?? [];
  const index = plays.findIndex((play) => play.id === input.id && play.agencyId === snapshot.agencyId);
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  const current = plays[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }

  const bettor = getBettor(snapshot, input.bettorId);
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });
  assertCents(input.payoutCents, { allowZero: true });

  const updated: BettorPlay = {
    id: current.id,
    agencyId: current.agencyId,
    bettorId: bettor.id,
    date: input.date,
    amountCents: input.amountCents,
    payoutCents: input.payoutCents,
  };
  const bettorPlays = plays.slice();
  bettorPlays[index] = updated;
  repository.save({ ...snapshot, bettorPlays });
  return updated;
}

export type RecordBettorPaymentInput = {
  bettorId: string;
  date: string;
  amountCents: number;
};

export function recordBettorPayment(repository: LedgerRepository, input: RecordBettorPaymentInput): BettorPayment {
  const snapshot = repository.load();
  const bettor = getBettor(snapshot, input.bettorId);
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });

  const payment: BettorPayment = {
    id: createId("payment"),
    agencyId: snapshot.agencyId,
    bettorId: bettor.id,
    date: input.date,
    amountCents: input.amountCents,
  };
  repository.save({ ...snapshot, bettorPayments: [...(snapshot.bettorPayments ?? []), payment] });
  return payment;
}

export type UpdateBettorPaymentInput = RecordBettorPaymentInput & { id: string };

export function updateBettorPayment(repository: LedgerRepository, input: UpdateBettorPaymentInput): BettorPayment {
  const snapshot = repository.load();
  const payments = snapshot.bettorPayments ?? [];
  const index = payments.findIndex((payment) => payment.id === input.id && payment.agencyId === snapshot.agencyId);
  if (index === -1) {
    throw new LedgerError("unknown-entry");
  }

  const current = payments[index];
  if (!current) {
    throw new LedgerError("unknown-entry");
  }

  const bettor = getBettor(snapshot, input.bettorId);
  assertIsoDate(input.date);
  assertCents(input.amountCents, { allowZero: false });

  const updated: BettorPayment = {
    ...current,
    bettorId: bettor.id,
    date: input.date,
    amountCents: input.amountCents,
  };
  const bettorPayments = payments.slice();
  bettorPayments[index] = updated;
  repository.save({ ...snapshot, bettorPayments });
  return updated;
}
