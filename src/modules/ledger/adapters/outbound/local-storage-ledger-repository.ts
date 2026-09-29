import { createAugust2026Snapshot } from "./august-2026-seed";
import type { LedgerRepository } from "../../application/ports/ledger-repository";
import type { LedgerSnapshot } from "../../domain/types";

export const LEDGER_STORAGE_KEY = "hippo-pro.ledger.v1";

export type JsonStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isLedgerSnapshot(value: unknown): value is LedgerSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as LedgerSnapshot;
  return (
    typeof snapshot.agencyId === "string" &&
    typeof snapshot.month === "string" &&
    Array.isArray(snapshot.days) &&
    Array.isArray(snapshot.deposits) &&
    Array.isArray(snapshot.expenses) &&
    Array.isArray(snapshot.openingBalances)
  );
}

function readStored(storage: JsonStorage, fallback: LedgerSnapshot): LedgerSnapshot {
  try {
    const raw = storage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) {
      return structuredClone(fallback);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isLedgerSnapshot(parsed)) {
      return structuredClone(fallback);
    }
    return structuredClone(parsed);
  } catch {
    return structuredClone(fallback);
  }
}

function writeStored(storage: JsonStorage, snapshot: LedgerSnapshot): void {
  try {
    storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode: keep going with the in-memory copy.
  }
}

export function createMemoryJsonStorage(initial: Record<string, string> = {}): JsonStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

export function createLocalStorageLedgerRepository(
  storage: JsonStorage,
  seed: LedgerSnapshot = createAugust2026Snapshot(),
): LedgerRepository {
  const initial = structuredClone(seed);
  let current = readStored(storage, initial);

  return {
    load: () => structuredClone(current),
    save: (snapshot) => {
      current = structuredClone(snapshot);
      writeStored(storage, current);
    },
    reset: () => {
      current = structuredClone(initial);
      writeStored(storage, current);
    },
  };
}
