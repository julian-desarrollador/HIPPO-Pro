import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import { buildMonthReport } from "../../application/use-cases/build-month-report";
import { recordDay } from "../../application/use-cases/record-day";
import { recordExpense } from "../../application/use-cases/record-expense";
import { summarizeMonth } from "../../application/use-cases/summarize-month";
import { createAugust2026Snapshot } from "./august-2026-seed";
import { createInMemoryLedgerRepository } from "./in-memory-ledger-repository";

describe("agosto 2026", () => {
  const summary = summarizeMonth(createAugust2026Snapshot());

  it("conserva el neto y la comisión de cada hipódromo", () => {
    const byId = Object.fromEntries(summary.racetracks.map((track) => [track.racetrackId, track]));

    assert.equal(byId["san-isidro"].netCents, 2_766_196_600);
    assert.equal(byId["san-isidro"].commissionCents, 414_929_490);
    assert.equal(byId.palermo.netCents, 2_678_615_500);
    assert.equal(byId.palermo.commissionCents, 241_075_395);
    assert.equal(byId["la-plata"].netCents, 988_011_600);
    assert.equal(byId["la-plata"].commissionCents, 148_201_740);
  });

  it("la facturación, las salidas y el saldo del mes coinciden con el Excel", () => {
    assert.equal(summary.billingCents, 804_206_625);
    assert.equal(summary.outflowCents, 599_983_000);
    assert.equal(summary.balanceCents, 204_223_625);
  });

  it("separa los adelantos de socios de los gastos de la agencia", () => {
    assert.equal(summary.agencyExpenseCents, 249_983_000);
    assert.equal(summary.partnerWithdrawalCents, 350_000_000);
    assert.equal(summary.agencyExpenseCents + summary.partnerWithdrawalCents, summary.outflowCents);
  });

  it("el saldo a pagar de cada hipódromo coincide con la planilla", () => {
    const byId = Object.fromEntries(summary.racetracks.map((track) => [track.racetrackId, track]));

    assert.equal(byId["san-isidro"].owedCents, 300_383_865);
    assert.equal(byId.palermo.owedCents, 399_615_405);
    assert.equal(byId["la-plata"].owedCents, 121_663_170);
  });

  it("arma el texto del mes con la facturación y el saldo", () => {
    const report = buildMonthReport(summary);
    assert.match(report, /8\.042\.066,25/);
    assert.match(report, /2\.042\.236,25/);
    assert.match(report, /San Isidro/);
  });
});

describe("recordDay", () => {
  it("no deja cargar dos veces el mismo día y el mismo hipódromo", () => {
    const repository = createInMemoryLedgerRepository();

    assert.throws(
      () =>
        recordDay(repository, {
          date: "2026-08-02",
          racetrackId: "san-isidro",
          soldCents: 100,
          cancelledCents: 0,
          paidCents: 0,
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-day",
    );
  });

  it("suma una carga nueva al neto del mes", () => {
    const repository = createInMemoryLedgerRepository();
    recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    const summary = summarizeMonth(repository.load());
    const sanIsidro = summary.racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(sanIsidro?.netCents, 2_766_196_600 + 1_000_000);
  });

  it("un adelanto de socio no se mezcla con los gastos de la agencia", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    recordExpense(repository, {
      paidOn: "2026-08-16",
      categoryId: "adelanto-fede",
      detail: "Prueba",
      amountCents: 10_000,
    });
    const after = summarizeMonth(repository.load());

    assert.equal(after.agencyExpenseCents, before.agencyExpenseCents);
    assert.equal(after.partnerWithdrawalCents, before.partnerWithdrawalCents + 10_000);
  });
});
