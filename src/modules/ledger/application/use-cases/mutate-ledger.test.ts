import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import { addBettor, removeBettor, updateBettor } from "./manage-bettors";
import { addExpenseCategory, removeExpenseCategory, updateExpenseCategory } from "./manage-expense-categories";
import { addRacetrack, removeRacetrack, updateRacetrack } from "./manage-racetracks";
import { recordBettorPayment, recordBettorPlay } from "./mutate-bettor-ledger";
import { recordDay } from "./record-day";
import { recordDeposit } from "./record-deposit";
import { recordExpense } from "./record-expense";
import { removeBettorPlay, removeDay, removeDeposit, removeExpense } from "./remove-entry";
import { getBettorAccount } from "./summarize-bettors";
import { listSettledDays, summarizeMonth } from "./summarize-month";
import { listExpenseCategories } from "../../domain/expense-categories";
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

describe("otros meses", () => {
  it("un día de septiembre no mueve agosto y arrastra el saldo a pagar", () => {
    const repository = createInMemoryLedgerRepository();
    const augustBefore = summarizeMonth(repository.load());
    recordDay(repository, {
      date: "2026-09-02",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    recordExpense(repository, {
      paidOn: "2026-09-03",
      categoryId: "luz",
      detail: "Septiembre",
      amountCents: 10_000,
      month: "2026-09",
    });

    const augustAfter = summarizeMonth(repository.load());
    assert.equal(augustAfter.billingCents, augustBefore.billingCents);
    assert.equal(augustAfter.outflowCents, augustBefore.outflowCents);
    const augustSanIsidro = augustBefore.racetracks.find((track) => track.racetrackId === "san-isidro");
    const augustSanIsidroAfter = augustAfter.racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(augustSanIsidroAfter?.owedCents, augustSanIsidro?.owedCents);

    const september = summarizeMonth(repository.load(), "2026-09");
    const septemberSanIsidro = september.racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(septemberSanIsidro?.openingCents, augustSanIsidro?.owedCents);
    assert.equal(septemberSanIsidro?.netCents, 1_000_000);
    assert.equal(september.agencyExpenseCents, 10_000);
    assert.equal(listSettledDays(repository.load(), "2026-09").length, 1);
  });
});

describe("hipódromos agregados", () => {
  it("un hipódromo nuevo no mueve agosto y usa su comisión y su ajuste", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    const added = addRacetrack(repository, {
      name: "La Punta",
      commissionBasisPoints: 1000,
      depositAdjustmentBasisPoints: -200,
    });
    assert.equal(added.id, "la-punta");

    const afterAdd = summarizeMonth(repository.load());
    assert.equal(afterAdd.billingCents, before.billingCents);
    assert.equal(afterAdd.outflowCents, before.outflowCents);
    const sanIsidroBefore = before.racetracks.find((track) => track.racetrackId === "san-isidro");
    const sanIsidroAfter = afterAdd.racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(sanIsidroAfter?.owedCents, sanIsidroBefore?.owedCents);
    assert.equal(afterAdd.racetracks.find((track) => track.racetrackId === "la-punta")?.owedCents, 0);

    recordDay(repository, {
      date: "2026-09-04",
      racetrackId: "la-punta",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    const august = summarizeMonth(repository.load());
    assert.equal(august.billingCents, before.billingCents);
    const september = summarizeMonth(repository.load(), "2026-09").racetracks.find((track) => track.racetrackId === "la-punta");
    assert.equal(september?.netCents, 1_000_000);
    assert.equal(september?.commissionCents, 100_000);
    assert.equal(september?.amountToDepositCents, 980_000);
  });

  it("rechaza un nombre vacío, uno repetido y quitar un hipódromo fijo", () => {
    const repository = createInMemoryLedgerRepository();
    assert.throws(
      () => addRacetrack(repository, { name: "   ", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-name",
    );
    assert.throws(
      () => addRacetrack(repository, { name: "San Isidro", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-racetrack",
    );
    assert.throws(
      () => removeRacetrack(repository, "san-isidro"),
      (error: unknown) => error instanceof LedgerError && error.code === "racetrack-in-use",
    );
  });

  it("editar San Isidro no mueve agosto y un día nuevo usa la comisión y el ajuste nuevos", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    updateRacetrack(repository, {
      id: "san-isidro",
      name: "San Isidro Norte",
      commissionBasisPoints: 2000,
      depositAdjustmentBasisPoints: -1000,
    });
    const after = summarizeMonth(repository.load());
    assert.equal(after.billingCents, before.billingCents);
    assert.equal(after.owedCents, before.owedCents);
    assert.equal(after.racetracks.find((track) => track.racetrackId === "san-isidro")?.name, "San Isidro Norte");
    const augustDay = listSettledDays(repository.load()).find((day) => day.racetrackId === "san-isidro");
    assert.equal(augustDay?.commissionBasisPoints, 1500);

    recordDay(repository, {
      date: "2026-09-04",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    const september = summarizeMonth(repository.load(), "2026-09").racetracks.find((track) => track.racetrackId === "san-isidro");
    assert.equal(september?.commissionCents, 200_000);
    assert.equal(september?.amountToDepositCents, 900_000);
    const stillAugust = summarizeMonth(repository.load());
    assert.equal(stillAugust.billingCents, before.billingCents);
    assert.equal(stillAugust.owedCents, before.owedCents);
  });

  it("quita un hipódromo fijo solo si no tiene días ni depósitos y no vuelve a la lista", () => {
    const repository = createInMemoryLedgerRepository();
    const snapshot = repository.load();
    repository.save({
      ...snapshot,
      days: snapshot.days.filter((day) => day.racetrackId !== "san-isidro"),
      deposits: snapshot.deposits.filter((deposit) => deposit.racetrackId !== "san-isidro"),
    });
    removeRacetrack(repository, "san-isidro");
    assert.equal(
      listSettledDays(repository.load()).some((day) => day.racetrackId === "san-isidro"),
      false,
    );
    assert.equal(
      summarizeMonth(repository.load()).racetracks.some((track) => track.racetrackId === "san-isidro"),
      false,
    );
  });

  it("renombrar conserva el id y cambiar la comisión no mueve un día ya cargado", () => {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, { name: "La Punta", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: -200 });
    const day = recordDay(repository, {
      date: "2026-09-04",
      racetrackId: "la-punta",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    updateRacetrack(repository, {
      id: "la-punta",
      name: "La Punta Norte",
      commissionBasisPoints: 2000,
      depositAdjustmentBasisPoints: -400,
    });
    const snapshot = repository.load();
    assert.equal(snapshot.days.find((entry) => entry.id === day.id)?.racetrackId, "la-punta");
    const september = summarizeMonth(snapshot, "2026-09").racetracks.find((track) => track.racetrackId === "la-punta");
    assert.equal(september?.name, "La Punta Norte");
    assert.equal(september?.commissionCents, 100_000);
    assert.equal(snapshot.days.find((entry) => entry.id === day.id)?.depositAdjustmentBasisPoints, -200);
    assert.equal(september?.amountToDepositCents, 980_000);
  });

  it("no deja quitar un hipódromo con un día y sí lo deja si está vacío", () => {
    const repository = createInMemoryLedgerRepository();
    const augustBefore = summarizeMonth(repository.load());
    addRacetrack(repository, { name: "La Punta", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 });
    const day = recordDay(repository, {
      date: "2026-09-04",
      racetrackId: "la-punta",
      soldCents: 100,
      cancelledCents: 0,
      paidCents: 0,
    });
    assert.throws(
      () => removeRacetrack(repository, "la-punta"),
      (error: unknown) => error instanceof LedgerError && error.code === "racetrack-in-use",
    );
    assert.equal(
      repository.load().days.some((entry) => entry.id === day.id),
      true,
    );
    removeDay(repository, day.id);
    removeRacetrack(repository, "la-punta");
    const after = summarizeMonth(repository.load());
    assert.equal(after.billingCents, augustBefore.billingCents);
    assert.equal(
      after.racetracks.some((track) => track.racetrackId === "la-punta"),
      false,
    );
  });

  it("no deja quitar un hipódromo con un depósito", () => {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, { name: "La Punta", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 });
    recordDeposit(repository, {
      date: "2026-09-04",
      racetrackId: "la-punta",
      amountCents: 100,
    });
    assert.throws(
      () => removeRacetrack(repository, "la-punta"),
      (error: unknown) => error instanceof LedgerError && error.code === "racetrack-in-use",
    );
  });
});

describe("categorías de gastos agregadas", () => {
  it("una categoría nueva no mueve agosto y entra como gasto de la agencia", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    const added = addExpenseCategory(repository, { label: "Seguro" });
    assert.equal(added.id, "seguro");
    assert.equal(added.kind, "agency");

    const afterAdd = summarizeMonth(repository.load());
    assert.equal(afterAdd.outflowCents, before.outflowCents);
    assert.equal(afterAdd.agencyExpenseCents, before.agencyExpenseCents);

    recordExpense(repository, {
      paidOn: "2026-09-04",
      categoryId: "seguro",
      detail: "",
      amountCents: 10_000,
      month: "2026-09",
    });
    const august = summarizeMonth(repository.load());
    assert.equal(august.outflowCents, before.outflowCents);
    const september = summarizeMonth(repository.load(), "2026-09");
    assert.equal(september.agencyExpenseCents, 10_000);
    assert.equal(september.partnerWithdrawalCents, 0);
  });

  it("rechaza un nombre vacío, uno repetido y quitar una categoría fija", () => {
    const repository = createInMemoryLedgerRepository();
    assert.throws(
      () => addExpenseCategory(repository, { label: "   " }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-name",
    );
    assert.throws(
      () => addExpenseCategory(repository, { label: "Luz" }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-category",
    );
    addExpenseCategory(repository, { label: "Seguro" });
    assert.throws(
      () => addExpenseCategory(repository, { label: "Seguro" }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-category",
    );
    assert.throws(
      () => removeExpenseCategory(repository, "luz"),
      (error: unknown) => error instanceof LedgerError && error.code === "category-in-use",
    );
  });

  it("renombrar Adelanto Fede no cambia el kind ni agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    const expense = repository.load().expenses.find((entry) => entry.categoryId === "adelanto-fede");
    assert.equal(expense?.kind, "partner-withdrawal");
    updateExpenseCategory(repository, { id: "adelanto-fede", label: "Adelanto Federico" });
    const listed = listExpenseCategories(repository.load()).find((category) => category.id === "adelanto-fede");
    assert.equal(listed?.label, "Adelanto Federico");
    assert.equal(listed?.kind, "partner-withdrawal");
    assert.equal(repository.load().expenses.find((entry) => entry.id === expense?.id)?.kind, "partner-withdrawal");
    const after = summarizeMonth(repository.load());
    assert.equal(after.outflowCents, before.outflowCents);
    assert.equal(after.partnerWithdrawalCents, before.partnerWithdrawalCents);
  });

  it("quita una categoría de agosto si no tiene gastos y no vuelve a la lista", () => {
    const repository = createInMemoryLedgerRepository();
    const snapshot = repository.load();
    repository.save({
      ...snapshot,
      expenses: snapshot.expenses.filter((expense) => expense.categoryId !== "estufa"),
    });
    removeExpenseCategory(repository, "estufa");
    assert.equal(
      listExpenseCategories(repository.load()).some((category) => category.id === "estufa"),
      false,
    );
  });

  it("renombrar conserva el id y no cambia el kind de un gasto ya cargado", () => {
    const repository = createInMemoryLedgerRepository();
    addExpenseCategory(repository, { label: "Seguro" });
    const expense = recordExpense(repository, {
      paidOn: "2026-09-04",
      categoryId: "seguro",
      detail: "",
      amountCents: 10_000,
      month: "2026-09",
    });
    updateExpenseCategory(repository, { id: "seguro", label: "Seguro del local" });
    const stored = repository.load().expenses.find((entry) => entry.id === expense.id);
    assert.equal(stored?.categoryId, "seguro");
    assert.equal(stored?.kind, "agency");
    assert.equal(listExpenseCategories(repository.load().expenseCategories).find((category) => category.id === "seguro")?.label, "Seguro del local");
  });

  it("no deja quitar una categoría con un gasto y sí lo deja si está vacía", () => {
    const repository = createInMemoryLedgerRepository();
    const augustBefore = summarizeMonth(repository.load());
    addExpenseCategory(repository, { label: "Seguro" });
    const expense = recordExpense(repository, {
      paidOn: "2026-09-04",
      categoryId: "seguro",
      detail: "",
      amountCents: 10_000,
      month: "2026-09",
    });
    assert.throws(
      () => removeExpenseCategory(repository, "seguro"),
      (error: unknown) => error instanceof LedgerError && error.code === "category-in-use",
    );
    removeExpense(repository, expense.id);
    removeExpenseCategory(repository, "seguro");
    const after = summarizeMonth(repository.load());
    assert.equal(after.outflowCents, augustBefore.outflowCents);
    assert.equal(
      (repository.load().expenseCategories ?? []).some((category) => category.id === "seguro"),
      false,
    );
  });
});

describe("cuentas de apostadores", () => {
  it("lo apostado suma deuda y lo cobrado la baja, también si el dividendo supera la apuesta", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    const bettor = addBettor(repository, { name: "Carlos" });
    assert.equal(getBettorAccount(repository.load(), bettor.id).statusLabel, "Al día");
    assert.equal(getBettorAccount(repository.load(), bettor.id).balanceCents, 0);

    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-08-16", amountCents: 10_000, payoutCents: 0 });
    assert.equal(getBettorAccount(repository.load(), bettor.id).balanceCents, 10_000);
    assert.equal(getBettorAccount(repository.load(), bettor.id).statusLabel, "Debe");

    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-08-17", amountCents: 20_000, payoutCents: 8_000 });
    assert.equal(getBettorAccount(repository.load(), bettor.id).balanceCents, 22_000);
    assert.equal(getBettorAccount(repository.load(), bettor.id).statusLabel, "Debe");

    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-08-18", amountCents: 10_000, payoutCents: 35_000 });
    assert.equal(getBettorAccount(repository.load(), bettor.id).balanceCents, -3_000);
    assert.equal(getBettorAccount(repository.load(), bettor.id).statusLabel, "A favor");

    recordBettorPayment(repository, { bettorId: bettor.id, date: "2026-08-19", amountCents: 5_000 });
    assert.equal(getBettorAccount(repository.load(), bettor.id).balanceCents, -8_000);
    assert.equal(getBettorAccount(repository.load(), bettor.id).statusLabel, "A favor");

    const after = summarizeMonth(repository.load());
    assert.equal(after.outflowCents, before.outflowCents);
    assert.equal(after.balanceCents, before.balanceCents);
  });

  it("un día viejo marcado como acertó sigue a favor por ese monto", () => {
    const repository = createInMemoryLedgerRepository();
    const bettor = addBettor(repository, { name: "Carlos" });
    const snapshot = repository.load();
    repository.save({
      ...snapshot,
      bettorPlays: [
        {
          id: "play-legacy",
          agencyId: snapshot.agencyId,
          bettorId: bettor.id,
          date: "2026-08-16",
          outcome: "won",
          amountCents: 25_000,
        },
      ],
    });
    const account = getBettorAccount(repository.load(), bettor.id);
    assert.equal(account.balanceCents, -25_000);
    assert.equal(account.movements[0]?.stakeCents, 0);
    assert.equal(account.movements[0]?.payoutCents, 25_000);
  });

  it("rechaza un nombre vacío, uno repetido y quitar un apostador con un día", () => {
    const repository = createInMemoryLedgerRepository();
    assert.throws(
      () => addBettor(repository, { name: "   " }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-name",
    );
    const bettor = addBettor(repository, { name: "Carlos" });
    assert.throws(
      () => addBettor(repository, { name: "Carlos" }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-bettor",
    );
    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-08-16", amountCents: 10_000, payoutCents: 0 });
    assert.throws(
      () => removeBettor(repository, bettor.id),
      (error: unknown) => error instanceof LedgerError && error.code === "bettor-in-use",
    );
    updateBettor(repository, { id: bettor.id, name: "Carlos Pérez" });
    assert.equal(getBettorAccount(repository.load(), bettor.id).name, "Carlos Pérez");
  });

  it("quita un apostador vacío y no mueve agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    const bettor = addBettor(repository, { name: "Carlos" });
    const play = recordBettorPlay(repository, {
      bettorId: bettor.id,
      date: "2026-08-16",
      amountCents: 10_000,
      payoutCents: 0,
    });
    assert.throws(
      () => removeBettor(repository, bettor.id),
      (error: unknown) => error instanceof LedgerError && error.code === "bettor-in-use",
    );
    removeBettorPlay(repository, play.id);
    removeBettor(repository, bettor.id);
    const after = summarizeMonth(repository.load());
    assert.equal(after.outflowCents, before.outflowCents);
    assert.equal(
      (repository.load().bettors ?? []).some((item) => item.id === bettor.id),
      false,
    );
  });
});
