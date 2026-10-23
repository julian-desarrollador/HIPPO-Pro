import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAugust2026Snapshot } from "../adapters/outbound/august-2026-seed";
import { createInMemoryLedgerRepository } from "../adapters/outbound/in-memory-ledger-repository";
import { summarizeMonth } from "../application/use-cases/summarize-month";
import { setTerminalServices } from "../application/use-cases/set-terminal-services";
import { LedgerError } from "./errors";
import { agencyModeFrom, homeHref, seesLottery, seesRacing } from "./features";
import { terminalServices } from "./terminal-services";

describe("modo de la agencia", () => {
  it("Hípica ve el libro de hípica y no el de lotería", () => {
    assert.equal(seesRacing("racing"), true);
    assert.equal(seesLottery("racing"), false);
    assert.equal(homeHref("racing"), "/");
  });

  it("Lotería ve quiniela y no las pantallas de hípica", () => {
    assert.equal(seesRacing("lottery"), false);
    assert.equal(seesLottery("lottery"), true);
    assert.equal(homeHref("lottery"), "/quiniela");
  });

  it("Las dos ve los dos libros", () => {
    assert.equal(seesRacing("both"), true);
    assert.equal(seesLottery("both"), true);
    assert.equal(homeHref("both"), "/");
  });

  it("un valor vacío o desconocido queda en hípica", () => {
    assert.equal(agencyModeFrom(undefined), "racing");
    assert.equal(agencyModeFrom("otra"), "racing");
    assert.equal(agencyModeFrom("lottery"), "lottery");
    assert.equal(agencyModeFrom("both"), "both");
  });
});

describe("servicios de la terminal", () => {
  it("arranca con hípica y lotería, y se puede apagar una", () => {
    const repository = createInMemoryLedgerRepository(createAugust2026Snapshot());
    const before = repository.load();
    assert.deepEqual(terminalServices(before, "1"), { racing: true, lottery: true });

    setTerminalServices(repository, { terminalId: "2", racing: false, lottery: true });
    const after = repository.load();
    assert.deepEqual(terminalServices(after, "2"), { racing: false, lottery: true });
    assert.deepEqual(terminalServices(after, "1"), { racing: true, lottery: true });
    assert.deepEqual(after.days, before.days);
    assert.equal(
      after.days.every((day) => day.terminalId === undefined),
      before.days.every((day) => day.terminalId === undefined),
    );
  });

  it("no deja una terminal sin ningún servicio", () => {
    const repository = createInMemoryLedgerRepository(createAugust2026Snapshot());
    assert.throws(
      () => setTerminalServices(repository, { terminalId: "1", racing: false, lottery: false }),
      (error: unknown) => error instanceof LedgerError && error.code === "terminal-needs-service",
    );
  });

  it("agosto no cambia si la terminal tiene servicios", () => {
    const seed = createAugust2026Snapshot();
    const withServices = {
      ...seed,
      terminalServices: [{ terminalId: "1" as const, racing: true, lottery: false }],
    };
    assert.deepEqual(summarizeMonth(withServices), summarizeMonth(seed));
  });
});
