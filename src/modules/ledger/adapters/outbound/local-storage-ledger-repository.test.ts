import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recordDay } from "../../application/use-cases/record-day";
import { createAugust2026Snapshot } from "./august-2026-seed";
import {
  LEDGER_STORAGE_KEY,
  createLocalStorageLedgerRepository,
  createMemoryJsonStorage,
} from "./local-storage-ledger-repository";

describe("repositorio localStorage", () => {
  it("si no hay dato, carga la semilla de agosto", () => {
    const storage = createMemoryJsonStorage();
    const repository = createLocalStorageLedgerRepository(storage);
    const seed = createAugust2026Snapshot();

    assert.equal(repository.load().days.length, seed.days.length);
    assert.equal(storage.getItem(LEDGER_STORAGE_KEY), null);
  });

  it("si el JSON está corrupto, vuelve a la semilla", () => {
    const storage = createMemoryJsonStorage({ [LEDGER_STORAGE_KEY]: "{no-json" });
    const repository = createLocalStorageLedgerRepository(storage);
    const seed = createAugust2026Snapshot();

    assert.equal(repository.load().days.length, seed.days.length);
  });

  it("si el objeto no es un snapshot, vuelve a la semilla", () => {
    const storage = createMemoryJsonStorage({ [LEDGER_STORAGE_KEY]: JSON.stringify({ foo: 1 }) });
    const repository = createLocalStorageLedgerRepository(storage);
    const seed = createAugust2026Snapshot();

    assert.equal(repository.load().days.length, seed.days.length);
  });

  it("guarda el snapshot y lo recupera en otra instancia", () => {
    const storage = createMemoryJsonStorage();
    const first = createLocalStorageLedgerRepository(storage);
    const before = first.load().days.length;
    recordDay(first, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    const raw = storage.getItem(LEDGER_STORAGE_KEY);
    assert.ok(raw);
    const second = createLocalStorageLedgerRepository(storage);
    assert.equal(second.load().days.length, before + 1);
    assert.ok(second.load().days.some((day) => day.date === "2026-08-16" && day.soldCents === 1_000_000));
  });

  it("reset vuelve a agosto y pisa lo guardado", () => {
    const storage = createMemoryJsonStorage();
    const repository = createLocalStorageLedgerRepository(storage);
    const seedCount = createAugust2026Snapshot().days.length;
    recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    repository.reset();

    assert.equal(repository.load().days.length, seedCount);
    const stored = JSON.parse(storage.getItem(LEDGER_STORAGE_KEY) ?? "null") as { days: unknown[] };
    assert.equal(stored.days.length, seedCount);
  });
});
