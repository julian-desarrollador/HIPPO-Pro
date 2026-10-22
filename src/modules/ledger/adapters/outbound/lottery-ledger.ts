import type { LotteryRepository } from "../../application/ports/lottery-repository";
import { LedgerError } from "../../domain/errors";
import type { LotterySnapshot } from "../../domain/lottery";
import type { LedgerRemoteRow } from "./agency-ledger";
import { isLotterySnapshot } from "./lottery-snapshot";

export type LotteryRemote = {
  read(agencyId: string): Promise<LedgerRemoteRow | null>;
  insert(agencyId: string, snapshot: LotterySnapshot): Promise<"created" | "exists">;
  update(agencyId: string, snapshot: LotterySnapshot, expectedVersion: number): Promise<number | "conflict">;
};

export type DurableLottery = LotteryRepository & {
  sync: () => Promise<void>;
};

function validRow(row: LedgerRemoteRow, agencyId: string): row is { snapshot: LotterySnapshot; version: number } {
  return (
    typeof row.version === "number" &&
    Number.isInteger(row.version) &&
    row.version > 0 &&
    isLotterySnapshot(row.snapshot) &&
    row.snapshot.agencyId === agencyId
  );
}

export function lotterySync(repository: LotteryRepository): Promise<void> {
  if ("sync" in repository && typeof repository.sync === "function") {
    return repository.sync();
  }
  return Promise.resolve();
}

/**
 * Opens the lottery row of the agency. Without a row the book is null and the
 * first save creates it: that is the activation.
 */
export async function openLotteryLedger(remote: LotteryRemote, agencyId: string): Promise<DurableLottery> {
  const row = await remote.read(agencyId);
  if (row && !validRow(row, agencyId)) {
    throw new LedgerError("save-failed");
  }

  let current: LotterySnapshot | null = row ? structuredClone(row.snapshot as LotterySnapshot) : null;
  let version = row ? row.version : 0;
  let confirmed = current ? structuredClone(current) : null;
  let confirmedVersion = version;
  let generation = 0;
  let queue = Promise.resolve();
  let inflight: Promise<void> = Promise.resolve();

  function revert() {
    generation += 1;
    current = confirmed ? structuredClone(confirmed) : null;
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

  function persist(next: LotterySnapshot): void {
    const gen = generation;
    const expected = version;
    version += 1;
    current = structuredClone(next);
    void enqueue(gen, async () => {
      let written: number | "conflict";
      try {
        if (expected === 0) {
          written = (await remote.insert(agencyId, next)) === "created" ? 1 : "conflict";
        } else {
          written = await remote.update(agencyId, next, expected);
        }
      } catch (error) {
        revert();
        if (error instanceof LedgerError) {
          throw error;
        }
        throw new LedgerError("save-failed");
      }

      if (written !== expected + 1) {
        const fresh = await remote.read(agencyId);
        if (fresh && validRow(fresh, agencyId)) {
          confirmed = structuredClone(fresh.snapshot);
          confirmedVersion = fresh.version;
        }
        revert();
        throw new LedgerError("save-conflict");
      }

      confirmed = structuredClone(next);
      confirmedVersion = expected + 1;
    }).catch(() => undefined);
  }

  return {
    load: () => (current ? structuredClone(current) : null),
    save: (snapshot) => {
      persist(snapshot);
    },
    sync: () => inflight,
  };
}
