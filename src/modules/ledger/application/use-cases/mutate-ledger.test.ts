import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import { recordDay } from "./record-day";
import { recordDeposit } from "./record-deposit";
import { recordExpense } from "./record-expense";
import { removeDay, removeDeposit, removeExpense } from "./remove-entry";
import { listSettledDays, summarizeMonth } from "./summarize-month";
import { updateCommission } from "./update-commission";
import { updateDay } from "./update-day";
import { updateDeposit } from "./update-deposit";
import { updateExpense } from "./update-expense";
import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";

describe("quitar movimientos", () => {
  it("quita un día por id y deja cargar de nuevo esa fecha y hipódromo", () => {
    const repository = createInMemoryLedgerRepository();
    const day = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    removeDay(repository, day.id);
    assert.equal(repository.load().days.some((entry) => entry.id === day.id), false);

    const again = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 2_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(again.soldCents, 2_000_000);
  });

  it("quita un depósito y un gasto; si el id no existe, falla", () => {
    const repository = createInMemoryLedgerRepository();
    const deposit = recordDeposit(repository, {
      date: "2026-08-16",
      racetrackId: "palermo",
      amountCents: 50_000,
    });
    const expense = recordExpense(repository, {
      paidOn: "2026-08-16",
      categoryId: "luz",
      detail: "Prueba",
      amountCents: 10_000,
    });

    removeDeposit(repository, deposit.id);
    removeExpense(repository, expense.id);
    assert.equal(repository.load().deposits.some((entry) => entry.id === deposit.id), false);
    assert.equal(repository.load().expenses.some((entry) => entry.id === expense.id), false);

    assert.throws(
      () => removeDay(repository, "day-inexistente"),
      (error: unknown) => error instanceof LedgerError && error.code === "unknown-entry",
    );
    assert.throws(
      () => removeDeposit(repository, deposit.id),
      (error: unknown) => error instanceof LedgerError && error.code === "unknown-entry",
    );
    assert.throws(
      () => removeExpense(repository, expense.id),
      (error: unknown) => error instanceof LedgerError && error.code === "unknown-entry",
    );
  });
});

describe("editar movimientos", () => {
  it("cambia los importes de un día y conserva el id", () => {
    const repository = createInMemoryLedgerRepository();
    const day = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    const updated = updateDay(repository, {
      id: day.id,
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 2_500_000,
      cancelledCents: 100_000,
      paidCents: 50_000,
    });

    assert.equal(updated.id, day.id);
    const stored = repository.load().days.find((entry) => entry.id === day.id);
    assert.equal(stored?.soldCents, 2_500_000);
    assert.equal(stored?.cancelledCents, 100_000);
    assert.equal(stored?.paidCents, 50_000);
  });

  it("al editar, duplicate-day ignora el propio id y falla si otra fila ya tiene esa fecha e hipódromo", () => {
    const repository = createInMemoryLedgerRepository();
    const seedDay = repository.load().days.find((day) => day.racetrackId === "san-isidro");
    assert.ok(seedDay);

    const created = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    const sameSlot = updateDay(repository, {
      id: created.id,
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_500_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(sameSlot.soldCents, 1_500_000);

    assert.throws(
      () =>
        updateDay(repository, {
          id: created.id,
          date: seedDay.date,
          racetrackId: seedDay.racetrackId,
          soldCents: 100,
          cancelledCents: 0,
          paidCents: 0,
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-day",
    );
  });

  it("cambia el monto de un depósito y de un gasto", () => {
    const repository = createInMemoryLedgerRepository();
    const deposit = recordDeposit(repository, {
      date: "2026-08-16",
      racetrackId: "la-plata",
      amountCents: 80_000,
    });
    const expense = recordExpense(repository, {
      paidOn: "2026-08-16",
      categoryId: "internet",
      detail: "Fibra",
      amountCents: 20_000,
    });

    updateDeposit(repository, {
      id: deposit.id,
      date: "2026-08-20",
      racetrackId: "palermo",
      amountCents: 90_000,
    });
    updateExpense(repository, {
      id: expense.id,
      paidOn: "2026-08-21",
      categoryId: "luz",
      detail: "Factura",
      amountCents: 25_000,
    });

    const storedDeposit = repository.load().deposits.find((entry) => entry.id === deposit.id);
    const storedExpense = repository.load().expenses.find((entry) => entry.id === expense.id);
    assert.equal(storedDeposit?.amountCents, 90_000);
    assert.equal(storedDeposit?.date, "2026-08-20");
    assert.equal(storedDeposit?.racetrackId, "palermo");
    assert.equal(storedExpense?.amountCents, 25_000);
    assert.equal(storedExpense?.categoryId, "luz");
    assert.equal(storedExpense?.detail, "Factura");
  });

  it("si el id no existe, la edición falla", () => {
    const repository = createInMemoryLedgerRepository();
    assert.throws(
      () =>
        updateDay(repository, {
          id: "day-inexistente",
          date: "2026-08-16",
          racetrackId: "san-isidro",
          soldCents: 100,
          cancelledCents: 0,
          paidCents: 0,
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "unknown-entry",
    );
  });
});

describe("comisión del hipódromo", () => {
  it("un día cargado con 15% sigue en 15% aunque después cambie la comisión", () => {
    const repository = createInMemoryLedgerRepository();
    const day = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(day.commissionBasisPoints, 1500);

    updateCommission(repository, { racetrackId: "san-isidro", commissionBasisPoints: 2000 });

    const settled = listSettledDays(repository.load()).find((entry) => entry.id === day.id);
    assert.equal(settled?.commissionBasisPoints, 1500);
    assert.equal(settled?.commissionCents, 150_000);
    const sanIsidroLater = recordDay(repository, {
      date: "2026-08-18",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(sanIsidroLater.commissionBasisPoints, 2000);
  });

  it("editar importes conserva el porcentaje y cambiar de hipódromo toma el vigente", () => {
    const repository = createInMemoryLedgerRepository();
    updateCommission(repository, { racetrackId: "palermo", commissionBasisPoints: 1200 });
    const day = recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });

    const edited = updateDay(repository, {
      id: day.id,
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 2_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(edited.commissionBasisPoints, 1500);

    const moved = updateDay(repository, {
      id: day.id,
      date: "2026-08-16",
      racetrackId: "palermo",
      soldCents: 2_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.equal(moved.commissionBasisPoints, 1200);
  });

  it("un porcentaje inválido no se guarda", () => {
    const repository = createInMemoryLedgerRepository();
    assert.throws(
      () => updateCommission(repository, { racetrackId: "san-isidro", commissionBasisPoints: 10_001 }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-percent",
    );
    assert.throws(
      () => updateCommission(repository, { racetrackId: "san-isidro", commissionBasisPoints: 15.5 }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-percent",
    );
    assert.equal(repository.load().commissions, undefined);
  });

  it("agosto no cambia aunque se modifique la comisión vigente", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    updateCommission(repository, { racetrackId: "san-isidro", commissionBasisPoints: 2000 });
    const after = summarizeMonth(repository.load());

    assert.equal(after.billingCents, before.billingCents);
    const beforeSanIsidro = before.racetracks.find((track) => track.racetrackId === "san-isidro");
    const afterSanIsidro = after.racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(afterSanIsidro?.commissionCents, beforeSanIsidro?.commissionCents);
  });
});
