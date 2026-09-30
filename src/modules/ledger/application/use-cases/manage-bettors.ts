import { LedgerError } from "../../domain/errors";
import { bettorHasMovements, listBettors } from "../../domain/bettor-account";
import type { Bettor } from "../../domain/types";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddBettorInput = {
  name: string;
};

function comparableName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function normalizedName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new LedgerError("invalid-name");
  }
  return name;
}

export function addBettor(repository: LedgerRepository, input: AddBettorInput): Bettor {
  const snapshot = repository.load();
  const name = normalizedName(input.name);
  const duplicate = listBettors(snapshot).some((bettor) => comparableName(bettor.name) === comparableName(name));
  if (duplicate) {
    throw new LedgerError("duplicate-bettor");
  }

  const bettor: Bettor = { id: createId("bettor"), name };
  repository.save({ ...snapshot, bettors: [...(snapshot.bettors ?? []), bettor] });
  return bettor;
}

export type UpdateBettorInput = AddBettorInput & { id: string };

export function updateBettor(repository: LedgerRepository, input: UpdateBettorInput): Bettor {
  const snapshot = repository.load();
  const current = snapshot.bettors ?? [];
  const index = current.findIndex((bettor) => bettor.id === input.id);
  if (index === -1) {
    throw new LedgerError("unknown-bettor");
  }

  const name = normalizedName(input.name);
  const duplicate = listBettors(snapshot).some(
    (bettor) => bettor.id !== input.id && comparableName(bettor.name) === comparableName(name),
  );
  if (duplicate) {
    throw new LedgerError("duplicate-bettor");
  }

  const bettor: Bettor = { id: input.id, name };
  const bettors = current.slice();
  bettors[index] = bettor;
  repository.save({ ...snapshot, bettors });
  return bettor;
}

export function removeBettor(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const current = snapshot.bettors ?? [];
  if (!current.some((bettor) => bettor.id === id)) {
    throw new LedgerError("unknown-bettor");
  }
  if (bettorHasMovements(snapshot, id)) {
    throw new LedgerError("bettor-in-use");
  }

  repository.save({
    ...snapshot,
    bettors: current.filter((bettor) => bettor.id !== id),
  });
}
