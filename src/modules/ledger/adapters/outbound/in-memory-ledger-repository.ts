import { createAugust2026Snapshot } from "./august-2026-seed";
import type { LedgerRepository } from "../../application/ports/ledger-repository";
import type { LedgerSnapshot } from "../../domain/types";

export function createInMemoryLedgerRepository(
  seed: LedgerSnapshot = createAugust2026Snapshot(),
): LedgerRepository {
  const initial = structuredClone(seed);
  let current = structuredClone(initial);

  return {
    load: () => structuredClone(current),
    save: (snapshot) => {
      current = structuredClone(snapshot);
    },
    reset: () => {
      current = structuredClone(initial);
    },
  };
}
