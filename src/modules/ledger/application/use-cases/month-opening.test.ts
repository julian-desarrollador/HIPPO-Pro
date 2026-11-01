import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { describeLedgerChange } from "./describe-ledger-change";
import { removeRacetrack } from "./manage-racetracks";
import { monthStartBalances, setMonthOpening } from "./month-opening";
import { recordDeposit } from "./record-deposit";
import { summarizeMonth } from "./summarize-month";

const owner = { role: "owner" as const, currentMonth: "2026-11" };

function owed(repository: ReturnType<typeof createInMemoryLedgerRepository>, month: string, id: string) {
  return summarizeMonth(repository.load(), month).racetracks.find((track) => track.racetrackId === id);
}

describe("saldo al empezar el mes en una agencia en curso", () => {
  it("sin nada anotado, noviembre arrastra lo de octubre", () => {
    const repository = createInMemoryLedgerRepository();
    const start = monthStartBalances(repository.load(), "2026-11");
    const sanIsidro = start.lines.find((line) => line.racetrackId === "san-isidro");
    assert.equal(sanIsidro?.written, false);
    assert.equal(sanIsidro?.openingCents, owed(repository, "2026-10", "san-isidro")?.owedCents);
    assert.equal(start.firstMonth, false);
  });

  it("el saldo de noviembre reemplaza lo arrastrado y diciembre sigue desde ahí; agosto a octubre no cambian", () => {
    const repository = createInMemoryLedgerRepository();
    const august = summarizeMonth(repository.load(), "2026-08");
    const october = summarizeMonth(repository.load(), "2026-10");
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "san-isidro", amountCents: 100_000_000 }] });
    recordDeposit(repository, { date: "2026-11-05", racetrackId: "san-isidro", amountCents: 30_000_000 });

    assert.deepEqual(summarizeMonth(repository.load(), "2026-08"), august);
    assert.deepEqual(summarizeMonth(repository.load(), "2026-10"), october);
    assert.equal(owed(repository, "2026-11", "san-isidro")?.openingCents, 100_000_000);
    assert.equal(owed(repository, "2026-11", "san-isidro")?.owedCents, 70_000_000);
    assert.equal(owed(repository, "2026-12", "san-isidro")?.openingCents, 70_000_000);
    assert.equal(
      owed(repository, "2026-11", "palermo")?.openingCents,
      owed(repository, "2026-10", "palermo")?.owedCents,
    );
  });

  it("si el monto es igual a lo arrastrado no guarda nada, y en blanco vuelve a lo que venía", () => {
    const repository = createInMemoryLedgerRepository();
    const carried = monthStartBalances(repository.load(), "2026-11").lines.find((line) => line.racetrackId === "palermo")!;
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "palermo", amountCents: carried.carriedCents }] });
    assert.deepEqual(repository.load().monthOpenings, []);

    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "palermo", amountCents: 5_000 }] });
    assert.equal(repository.load().monthOpenings?.length, 1);
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "palermo", amountCents: null }] });
    assert.deepEqual(repository.load().monthOpenings, []);
  });

  it("en el primer mes del libro es el saldo inicial de siempre", () => {
    const repository = createInMemoryLedgerRepository();
    setMonthOpening(repository, { ...owner, month: "2026-08", balances: [{ racetrackId: "la-plata", amountCents: 12_345 }] });
    const opening = repository.load().openingBalances.find((item) => item.racetrackId === "la-plata");
    assert.equal(opening?.amountCents, 12_345);
    assert.equal(repository.load().monthOpenings, undefined);
    assert.equal(monthStartBalances(repository.load(), "2026-08").firstMonth, true);
  });

  it("rechaza un mes anterior al libro, uno que no empezó y al operador", () => {
    const repository = createInMemoryLedgerRepository();
    const balances = [{ racetrackId: "san-isidro", amountCents: 1 }];
    assert.throws(() => setMonthOpening(repository, { ...owner, month: "2026-07", balances }), (error) => error instanceof LedgerError && error.code === "invalid-opening-month");
    assert.throws(() => setMonthOpening(repository, { ...owner, month: "2026-12", balances }), (error) => error instanceof LedgerError && error.code === "invalid-opening-month");
    assert.throws(
      () => setMonthOpening(repository, { role: "operator", currentMonth: "2026-11", month: "2026-11", balances }),
      (error) => error instanceof LedgerError && error.code === "owner-only",
    );
  });

  it("no deja quitar un hipódromo con saldo anotado en un mes", () => {
    const repository = createInMemoryLedgerRepository();
    repository.save({
      ...repository.load(),
      days: repository.load().days.filter((day) => day.racetrackId !== "la-plata"),
      deposits: repository.load().deposits.filter((deposit) => deposit.racetrackId !== "la-plata"),
      openingBalances: repository.load().openingBalances.filter((opening) => opening.racetrackId !== "la-plata"),
    });
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "la-plata", amountCents: 500 }] });
    assert.throws(() => removeRacetrack(repository, "la-plata"), (error) => error instanceof LedgerError && error.code === "racetrack-in-use");
  });

  it("Historial anota el saldo anotado y la vuelta a lo que venía", () => {
    const repository = createInMemoryLedgerRepository();
    const before = repository.load();
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "san-isidro", amountCents: 100_000_000 }] });
    const written = repository.load();
    assert.match(describeLedgerChange(before, written) ?? "", /^Anotó el saldo al empezar noviembre 2026 con San Isidro: .* \(venía .*\)\.$/);
    setMonthOpening(repository, { ...owner, month: "2026-11", balances: [{ racetrackId: "san-isidro", amountCents: null }] });
    assert.match(describeLedgerChange(written, repository.load()) ?? "", /^Volvió al saldo que venía al empezar noviembre 2026 con San Isidro: /);
  });
});
