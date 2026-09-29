import type { LedgerRepository } from "../../application/ports/ledger-repository";
import { LedgerError } from "../../domain/errors";
import type { LedgerSnapshot } from "../../domain/types";
import { createAugust2026Snapshot } from "./august-2026-seed";
import { isLedgerSnapshot } from "./ledger-snapshot";

export type LedgerRemoteRow = {
  snapshot: unknown;
  version: number;
};

export type LedgerRemote = {
  read(agencyId: string): Promise<LedgerRemoteRow | null>;
  insert(agencyId: string, snapshot: LedgerSnapshot): Promise<"created" | "exists">;
  update(agencyId: string, snapshot: LedgerSnapshot, expectedVersion: number): Promise<number | "conflict">;
};

type DurableLedger = LedgerRepository & {
  sync: () => Promise<void>;
};

function withAgency(seed: LedgerSnapshot, agencyId: string): LedgerSnapshot {
  const copy = structuredClone(seed);
  if (copy.agencyId === agencyId) {
    return copy;
  }
  return {
    ...copy,
    agencyId,
    days: copy.days.map((day) => ({ ...day, agencyId })),
    deposits: copy.deposits.map((deposit) => ({ ...deposit, agencyId })),
    expenses: copy.expenses.map((expense) => ({ ...expense, agencyId })),
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function ledgerSync(repository: LedgerRepository): Promise<void> {
  if ("sync" in repository && typeof repository.sync === "function") {
    return repository.sync();
  }
  return Promise.resolve();
}

export async function openAgencyLedger(
  remote: LedgerRemote,
  agencyId: string,
  seed: LedgerSnapshot = createAugust2026Snapshot(),
): Promise<LedgerRepository> {
  const initialSeed = withAgency(seed, agencyId);
  let row = await remote.read(agencyId);
  if (!row) {
    await remote.insert(agencyId, initialSeed);
    row = await remote.read(agencyId);
  }

  if (!row || !isPositiveInteger(row.version) || !isLedgerSnapshot(row.snapshot) || row.snapshot.agencyId !== agencyId) {
    throw new LedgerError("save-failed");
  }

  let current = structuredClone(row.snapshot);
  let version = row.version;
  let confirmed = structuredClone(current);
  let confirmedVersion = version;
  let generation = 0;
  let queue = Promise.resolve();
  let inflight: Promise<void> = Promise.resolve();

  function revert() {
    generation += 1;
    current = structuredClone(confirmed);
    version = confirmedVersion;
  }

  function enqueue(gen: number, task: () => Promise<void>): Promise<void> {
    const run = queue.then(async () => {
      if (gen !== generation) {
        throw new LedgerError("save-conflict");
      }
      await task();
    });
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    inflight = run;
    return run;
  }

  function persist(next: LedgerSnapshot): void {
    const gen = generation;
    const expected = version;
    version += 1;
    current = structuredClone(next);
    enqueue(gen, async () => {
      let written: number | "conflict";
      try {
        written = await remote.update(agencyId, next, expected);
      } catch (error) {
        revert();
        if (error instanceof LedgerError) {
          throw error;
        }
        throw new LedgerError("save-failed");
      }

      if (written !== expected + 1) {
        const fresh = await remote.read(agencyId);
        if (fresh && isPositiveInteger(fresh.version) && isLedgerSnapshot(fresh.snapshot) && fresh.snapshot.agencyId === agencyId) {
          confirmed = structuredClone(fresh.snapshot);
          confirmedVersion = fresh.version;
        }
        revert();
        throw new LedgerError("save-conflict");
      }

      confirmed = structuredClone(next);
      confirmedVersion = expected + 1;
    });
  }

  const repository: DurableLedger = {
    load: () => structuredClone(current),
    save: (snapshot) => {
      persist(snapshot);
    },
    reset: () => {
      persist(initialSeed);
    },
    sync: () => inflight,
  };

  return repository;
}
