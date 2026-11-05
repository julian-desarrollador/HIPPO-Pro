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
import { getBettorAccount, shownBettorBalanceCents, summarizeBettorTotals } from "./summarize-bettors";
import { listSettledDays, summarizeMonth } from "./summarize-month";
import { categoryGoesToResult, expenseCategoriesFor, expenseCategoryLabel, listExpenseCategories } from "../../domain/expense-categories";
import { updateCommission } from "./update-commission";
import { updateDay } from "./update-day";
import { updateDeposit } from "./update-deposit";
import { updateExpense } from "./update-expense";
import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { createEmptyAgencySnapshot } from "../../adapters/outbound/starting-snapshot";
import { describeLedgerChange } from "./describe-ledger-change";
import { postponeStartingBalances, racingStartingStep, startRacingBook, sumStartingBalances } from "./start-book";

describe("terminales del mismo día", () => {
  it("guarda dos terminales, suma el neto y cuenta una reunión", () => {
    const repository = createInMemoryLedgerRepository();
    const first = recordDay(repository, {
      date: "2026-09-02",
      racetrackId: "san-isidro",
      terminalId: "1",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    const second = recordDay(repository, {
      date: "2026-09-02",
      racetrackId: "san-isidro",
      terminalId: "2",
      soldCents: 500_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    const track = summarizeMonth(repository.load(), "2026-09").racetracks.find((item) => item.racetrackId === "san-isidro");
    const settled = listSettledDays(repository.load(), "2026-09");
    const firstNet = settled.find((day) => day.id === first.id)?.netCents ?? 0;
    const secondNet = settled.find((day) => day.id === second.id)?.netCents ?? 0;
    assert.equal(track?.meetingCount, 1);
    assert.equal(track?.netCents, firstNet + secondNet);

    assert.throws(
      () =>
        recordDay(repository, {
          date: "2026-09-02",
          racetrackId: "san-isidro",
          terminalId: "1",
          soldCents: 100,
          cancelledCents: 0,
          paidCents: 0,
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-terminal",
    );
  });

  it("una fila sin terminal no deja cargar otra en ese día", () => {
    const repository = createInMemoryLedgerRepository();
    const seed = repository.load().days.find((day) => day.racetrackId === "san-isidro");
    assert.ok(seed);
    assert.equal(seed.terminalId, undefined);
    assert.throws(
      () =>
        recordDay(repository, {
          date: seed.date,
          racetrackId: seed.racetrackId,
          terminalId: "2",
          soldCents: 100,
          cancelledCents: 0,
          paidCents: 0,
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "duplicate-day",
    );
  });
});

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

  it("quita un hipódromo fijo solo si no tiene días, depósitos ni saldo inicial y no vuelve a la lista", () => {
    const repository = createInMemoryLedgerRepository();
    const snapshot = repository.load();
    repository.save({
      ...snapshot,
      days: snapshot.days.filter((day) => day.racetrackId !== "san-isidro"),
      deposits: snapshot.deposits.filter((deposit) => deposit.racetrackId !== "san-isidro"),
    });
    assert.throws(
      () => removeRacetrack(repository, "san-isidro"),
      (error: unknown) => error instanceof LedgerError && error.code === "racetrack-in-use",
    );
    repository.save({
      ...repository.load(),
      openingBalances: repository.load().openingBalances.filter((opening) => opening.racetrackId !== "san-isidro"),
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

  it("rechaza un nombre vacío y uno repetido", () => {
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

  it("una categoría vacía se borra del todo", () => {
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

describe("totales de cuentas", () => {
  it("resta lo a favor de lo que se debe", () => {
    assert.deepEqual(
      summarizeBettorTotals([{ balanceCents: 10_000 }, { balanceCents: -8_000 }, { balanceCents: 0 }]),
      { owedCents: 10_000, creditCents: 8_000, netCents: 2_000 },
    );
    assert.deepEqual(summarizeBettorTotals([{ balanceCents: 8_000 }, { balanceCents: -10_000 }]), {
      owedCents: 8_000,
      creditCents: 10_000,
      netCents: -2_000,
    });
    assert.deepEqual(summarizeBettorTotals([]), { owedCents: 0, creditCents: 0, netCents: 0 });
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
    assert.equal(shownBettorBalanceCents(10_000), -10_000);
    assert.equal(shownBettorBalanceCents(-3_000), 3_000);
    assert.equal(shownBettorBalanceCents(0), 0);

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

describe("saldo inicial con cada hipódromo", () => {
  function newAgency() {
    return createInMemoryLedgerRepository(createEmptyAgencySnapshot("agencia-prueba", new Date(2026, 9, 15)));
  }

  it("una agencia nueva arranca con lo que debe a cada hipódromo, sin comisión", () => {
    const repository = newAgency();
    addRacetrack(repository, { name: "San Isidro", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 100_000_000 });
    addRacetrack(repository, { name: "Palermo", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 200_000_000 });
    addRacetrack(repository, { name: "La Plata", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 50_000_000 });

    const summary = summarizeMonth(repository.load(), "2026-10");
    assert.equal(summary.owedCents, 350_000_000);
    assert.equal(summary.billingCents, 0);
    assert.equal(summary.balanceCents, 0);
    const palermo = summary.racetracks.find((track) => track.racetrackId === "palermo");
    assert.equal(palermo?.openingCents, 200_000_000);
    assert.equal(palermo?.commissionCents, 0);
  });

  it("lo cargado después suma al saldo inicial y el mes siguiente lo arrastra", () => {
    const repository = newAgency();
    addRacetrack(repository, { name: "La Plata", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 50_000_000 });
    recordDay(repository, { date: "2026-10-20", racetrackId: "la-plata", soldCents: 10_000_000, cancelledCents: 0, paidCents: 0 });
    recordDeposit(repository, { date: "2026-10-21", racetrackId: "la-plata", amountCents: 20_000_000 });

    const october = summarizeMonth(repository.load(), "2026-10").racetracks.find((track) => track.racetrackId === "la-plata");
    assert.ok(october);
    assert.equal(october.owedCents, 50_000_000 + october.amountToDepositCents - 20_000_000);
    const november = summarizeMonth(repository.load(), "2026-11").racetracks.find((track) => track.racetrackId === "la-plata");
    assert.equal(november?.openingCents, october.owedCents);
  });

  it("un saldo negativo es lo que el hipódromo le debe a la agencia", () => {
    const repository = newAgency();
    addRacetrack(repository, { name: "Palermo", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: -30_000_000 });
    assert.equal(summarizeMonth(repository.load(), "2026-10").owedCents, -30_000_000);
  });

  it("editar sin saldo lo conserva y en cero lo borra; con saldo no se puede quitar", () => {
    const repository = newAgency();
    const track = addRacetrack(repository, { name: "Palermo", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 10_000_000 });
    updateRacetrack(repository, { id: track.id, name: "Palermo", commissionBasisPoints: 1400, depositAdjustmentBasisPoints: 0 });
    assert.equal(summarizeMonth(repository.load(), "2026-10").owedCents, 10_000_000);

    const before = repository.load();
    updateRacetrack(repository, { id: track.id, name: "Palermo", commissionBasisPoints: 1400, depositAdjustmentBasisPoints: 0, openingCents: 0 });
    assert.deepEqual(repository.load().openingBalances, []);
    assert.match(describeLedgerChange(before, repository.load()) ?? "", /saldo inicial pasó/);

    updateRacetrack(repository, { id: track.id, name: "Palermo", commissionBasisPoints: 1400, depositAdjustmentBasisPoints: 0, openingCents: 5_000_000 });
    assert.throws(
      () => removeRacetrack(repository, track.id),
      (error: unknown) => error instanceof LedgerError && error.code === "racetrack-in-use",
    );
    updateRacetrack(repository, { id: track.id, name: "Palermo", commissionBasisPoints: 1400, depositAdjustmentBasisPoints: 0, openingCents: 0 });
    removeRacetrack(repository, track.id);
    assert.equal(repository.load().racetracks?.some((item) => item.id === track.id), false);
  });

  it("en Dolores, editar un hipódromo sin tocar el saldo no cambia agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    updateRacetrack(repository, { id: "palermo", name: "Palermo", commissionBasisPoints: 900, depositAdjustmentBasisPoints: 100, openingCents: -373_784_900 });
    assert.deepEqual(summarizeMonth(repository.load()), before);
  });
});

describe("bienvenida de una agencia nueva", () => {
  const at = "2026-10-15T12:00:00.000Z";
  function newAgency() {
    return createInMemoryLedgerRepository(createEmptyAgencySnapshot("agencia-prueba", new Date(2026, 9, 15)));
  }
  const fixed = (name: string, commissionBasisPoints: number, depositAdjustmentBasisPoints: number, openingCents: number) => ({
    name,
    commissionBasisPoints,
    depositAdjustmentBasisPoints,
    openingCents,
  });

  it("pide el estado de cuenta y lo carga de una vez, sin comisión", () => {
    const repository = newAgency();
    assert.equal(racingStartingStep(repository.load()), "welcome");
    const before = repository.load();
    startRacingBook(repository, {
      at,
      startMonth: "2026-10",
      racetracks: [
        fixed("San Isidro", 1500, -500, 100_000_000),
        fixed("Palermo", 900, 100, 200_000_000),
        fixed("La Plata", 1500, -500, 50_000_000),
      ],
    });
    const after = repository.load();
    assert.equal(racingStartingStep(after), null);
    const summary = summarizeMonth(after, "2026-10");
    assert.equal(summary.owedCents, 350_000_000);
    assert.equal(summary.billingCents, 0);
    assert.deepEqual(
      summary.racetracks.map((track) => track.racetrackId),
      ["san-isidro", "palermo", "la-plata"],
    );
    assert.match(describeLedgerChange(before, after) ?? "", /^Cargó el estado de cuenta inicial\./);
  });

  it("si un hipódromo está mal no guarda ninguno", () => {
    const repository = newAgency();
    assert.throws(
      () =>
        startRacingBook(repository, {
          at,
          startMonth: "2026-10",
          racetracks: [fixed("San Isidro", 1500, -500, 100_000_000), fixed("   ", 1000, 0, 0)],
        }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-name",
    );
    assert.equal(summarizeMonth(repository.load(), "2026-10").racetracks.length, 0);
    assert.equal(racingStartingStep(repository.load()), "welcome");
    assert.throws(
      () => startRacingBook(repository, { at, startMonth: "2026-10", racetracks: [] }),
      (error: unknown) => error instanceof LedgerError && error.code === "no-starting-racetrack",
    );
  });

  it("hacerlo luego deja un recordatorio hasta que se carga", () => {
    const repository = newAgency();
    postponeStartingBalances(repository, at);
    assert.equal(racingStartingStep(repository.load()), "reminder");
    startRacingBook(repository, { at, startMonth: "2026-10", racetracks: [fixed("Palermo", 900, 100, 0)] });
    assert.equal(racingStartingStep(repository.load()), null);
  });

  it("Dolores no ve la bienvenida y agosto no cambia", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    assert.equal(racingStartingStep(repository.load()), null);
    assert.deepEqual(summarizeMonth(repository.load()), before);
  });
});

describe("ajuste al depositar de una agencia nueva", () => {
  const at = "2026-10-15T12:00:00.000Z";
  function newAgency() {
    return createInMemoryLedgerRepository(createEmptyAgencySnapshot("agencia-prueba", new Date(2026, 9, 15)));
  }

  it("con ajuste de -5 % resta el 5 % del neto al depositar y la comisión no cambia", () => {
    const repository = newAgency();
    startRacingBook(repository, {
      at,
      startMonth: "2026-10",
      racetracks: [{ name: "Azul", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: -500, openingCents: 100_000_000 }],
    });
    recordDay(repository, { date: "2026-10-20", racetrackId: "azul", soldCents: 10_000_000, cancelledCents: 0, paidCents: 2_000_000 });
    const [day] = listSettledDays(repository.load(), "2026-10");
    assert.equal(day.netCents, 10_000_000);
    assert.equal(day.commissionCents, 1_500_000);
    assert.equal(day.amountToDepositCents, 10_000_000 - 2_000_000 - 500_000);
    const track = summarizeMonth(repository.load(), "2026-10").racetracks[0];
    assert.equal(track.owedCents, 100_000_000 + 7_500_000);
  });

  it("cambiar el ajuste vale para los días nuevos y no mueve uno ya cargado", () => {
    const repository = newAgency();
    const track = addRacetrack(repository, { name: "Azul", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0 });
    const first = recordDay(repository, { date: "2026-10-20", racetrackId: track.id, soldCents: 10_000_000, cancelledCents: 0, paidCents: 0 });
    updateRacetrack(repository, { id: track.id, name: "Azul", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 100 });
    const second = recordDay(repository, { date: "2026-10-21", racetrackId: track.id, soldCents: 10_000_000, cancelledCents: 0, paidCents: 0 });
    const days = listSettledDays(repository.load(), "2026-10");
    assert.equal(days.find((day) => day.id === first.id)?.amountToDepositCents, 10_000_000);
    assert.equal(days.find((day) => day.id === second.id)?.amountToDepositCents, 10_100_000);
  });

  it("en Dolores, cambiar el ajuste de Palermo no mueve agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    updateRacetrack(repository, { id: "palermo", name: "Palermo", commissionBasisPoints: 900, depositAdjustmentBasisPoints: 0 });
    assert.deepEqual(summarizeMonth(repository.load()), before);
  });
});

describe("mes desde el que carga una agencia nueva", () => {
  const at = "2026-10-15T12:00:00.000Z";
  const azul = { name: "Azul", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0, openingCents: 100_000_000 };
  function newAgency() {
    return createInMemoryLedgerRepository(createEmptyAgencySnapshot("agencia-prueba", new Date(2026, 9, 15)));
  }

  it("si empieza en septiembre, el saldo inicial es el del 1 de septiembre y lo de septiembre pasa a octubre", () => {
    const repository = newAgency();
    startRacingBook(repository, { at, startMonth: "2026-09", racetracks: [azul] });
    recordDay(repository, { date: "2026-09-10", racetrackId: "azul", soldCents: 10_000_000, cancelledCents: 0, paidCents: 0 });
    recordDeposit(repository, { date: "2026-09-12", racetrackId: "azul", amountCents: 4_000_000 });
    const september = summarizeMonth(repository.load(), "2026-09").racetracks[0];
    assert.equal(september.openingCents, 100_000_000);
    assert.equal(september.owedCents, 106_000_000);
    const october = summarizeMonth(repository.load(), "2026-10").racetracks[0];
    assert.equal(october.openingCents, 106_000_000);
  });

  it("no puede empezar en un mes posterior al de la apertura", () => {
    const repository = newAgency();
    assert.throws(
      () => startRacingBook(repository, { at, startMonth: "2026-11", racetracks: [azul] }),
      (error: unknown) => error instanceof LedgerError && error.code === "invalid-start-month",
    );
  });
});

describe("total del estado de cuenta inicial", () => {
  it("suma lo que se debe y resta lo que le deben a la agencia", () => {
    assert.equal(sumStartingBalances([{ openingCents: 100_000_000 }, { openingCents: 200_000_000 }, { openingCents: -50_000_000 }]), 250_000_000);
    assert.equal(sumStartingBalances([]), 0);
  });
});

describe("hipódromo con comisión descontada del depósito", () => {
  it("el día guarda la parte de la ganancia y el mes suma la comisión y lo que hay que depositar", () => {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, {
      name: "Rosario",
      commissionBasisPoints: 675,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: 2000,
    });
    const day = recordDay(repository, {
      date: "2026-09-03",
      racetrackId: "rosario",
      soldCents: 100_000_000,
      cancelledCents: 0,
      paidCents: 60_000_000,
    });
    assert.equal(day.profitShareBasisPoints, 2000);
    const track = summarizeMonth(repository.load(), "2026-09").racetracks.find((item) => item.racetrackId === "rosario");
    assert.equal(track?.commissionCents, 14_210_000);
    assert.equal(track?.owedCents, 25_790_000);
  });

  it("pasar el hipódromo a porcentaje fijo no cambia los días ya cargados", () => {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, {
      name: "Rosario",
      commissionBasisPoints: 675,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: 2000,
    });
    recordDay(repository, {
      date: "2026-09-03",
      racetrackId: "rosario",
      soldCents: 100_000_000,
      cancelledCents: 0,
      paidCents: 60_000_000,
    });
    updateRacetrack(repository, { id: "rosario", name: "Rosario", commissionBasisPoints: 1500, depositAdjustmentBasisPoints: 0 });
    assert.equal(repository.load().racetracks?.find((item) => item.id === "rosario")?.profitShareBasisPoints, undefined);
    const track = summarizeMonth(repository.load(), "2026-09").racetracks.find((item) => item.racetrackId === "rosario");
    assert.equal(track?.commissionCents, 14_210_000);
    assert.equal(track?.owedCents, 25_790_000);
  });

  it("un día cargado con porcentaje fijo no pasa a descontado si después cambia el hipódromo", () => {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, { name: "Rosario", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 });
    recordDay(repository, {
      date: "2026-09-03",
      racetrackId: "rosario",
      soldCents: 100_000_000,
      cancelledCents: 0,
      paidCents: 60_000_000,
    });
    updateRacetrack(repository, {
      id: "rosario",
      name: "Rosario",
      commissionBasisPoints: 675,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: 2000,
    });
    const track = summarizeMonth(repository.load(), "2026-09").racetracks.find((item) => item.racetrackId === "rosario");
    assert.equal(track?.commissionCents, 10_000_000);
    assert.equal(track?.owedCents, 40_000_000);
  });
});

describe("día en pérdida con comisión descontada del depósito", () => {
  function retainedTrack() {
    const repository = createInMemoryLedgerRepository();
    addRacetrack(repository, {
      name: "Rosario",
      commissionBasisPoints: 675,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: 2000,
    });
    return repository;
  }
  const owed = (repository: ReturnType<typeof createInMemoryLedgerRepository>) =>
    summarizeMonth(repository.load(), "2026-09").racetracks.find((item) => item.racetrackId === "rosario")?.owedCents;
  const load = (repository: ReturnType<typeof createInMemoryLedgerRepository>, date: string, soldCents: number, paidCents: number) =>
    recordDay(repository, { date, racetrackId: "rosario", soldCents, cancelledCents: 0, paidCents });

  it("lo perdido se descuenta de lo acumulado y el saldo que queda es lo que se deposita", () => {
    const repository = retainedTrack();
    load(repository, "2026-09-01", 400_000_000, 200_000_000);
    assert.equal(owed(repository), 135_700_000);
    load(repository, "2026-09-02", 100_000_000, 200_000_000);
    assert.equal(owed(repository), 28_950_000);
    recordDeposit(repository, { date: "2026-09-03", racetrackId: "rosario", amountCents: 28_950_000 });
    assert.equal(owed(repository), 0);
  });

  it("si lo perdido supera lo acumulado, el saldo queda negativo: el hipódromo le debe a la agencia", () => {
    const repository = retainedTrack();
    load(repository, "2026-09-01", 100_000_000, 60_000_000);
    load(repository, "2026-09-02", 100_000_000, 200_000_000);
    assert.equal(owed(repository), 25_790_000 - 106_750_000);
  });
});

describe("categoría que solo ve el dueño", () => {
  function withPrivateCategory() {
    const repository = createInMemoryLedgerRepository();
    addExpenseCategory(repository, { label: "Retiro socio", kind: "partner-withdrawal" });
    return repository;
  }

  it("sus gastos van a Resultado y el saldo del mes da lo mismo que con un gasto común", () => {
    const repository = withPrivateCategory();
    const categories = listExpenseCategories(repository.load());
    assert.equal(categoryGoesToResult(categories, "retiro-socio"), true);
    recordExpense(repository, { paidOn: "2026-09-04", categoryId: "retiro-socio", detail: "", amountCents: 10_000, month: "2026-09" });
    const month = summarizeMonth(repository.load(), "2026-09");
    assert.equal(month.partnerWithdrawalCents, 10_000);
    assert.equal(month.agencyExpenseCents, 0);
    assert.equal(month.outflowCents, 10_000);
  });

  it("el operador no la ve y el dueño sí", () => {
    const categories = listExpenseCategories(withPrivateCategory().load());
    assert.equal(expenseCategoriesFor("owner", categories).some((category) => category.id === "retiro-socio"), true);
    assert.equal(expenseCategoriesFor("operator", categories).some((category) => category.id === "retiro-socio"), false);
  });

  it("renombrarla no la vuelve pública", () => {
    const repository = withPrivateCategory();
    const renamed = updateExpenseCategory(repository, { id: "retiro-socio", label: "Retiro del socio" });
    assert.equal(renamed.kind, "partner-withdrawal");
    assert.equal(listExpenseCategories(repository.load()).find((category) => category.id === "retiro-socio")?.kind, "partner-withdrawal");
  });

  it("sin elegir, una categoría nueva es pública", () => {
    const repository = createInMemoryLedgerRepository();
    assert.equal(addExpenseCategory(repository, { label: "Seguro" }).kind, "agency");
  });
});

describe("Adelanto y Retiro en una agencia que no es Dolores", () => {
  const namedOnes = ["adelanto-fede", "adelanto-mati", "retiro-sag-fede", "retiro-sag-mati"];
  function otherAgency() {
    return createInMemoryLedgerRepository({ ...createEmptyAgencySnapshot("norte"), hiddenCategoryIds: namedOnes });
  }
  const find = (repository: ReturnType<typeof createInMemoryLedgerRepository>, label: string) =>
    listExpenseCategories(repository.load()).filter((category) => category.label === label);

  it("ya vienen creadas y solo las ve el dueño", () => {
    const categories = listExpenseCategories(otherAgency().load());
    assert.equal(categories.find((category) => category.label === "Adelanto")?.kind, "partner-withdrawal");
    assert.equal(categories.find((category) => category.label === "Retiro")?.kind, "partner-withdrawal");
    const forOperator = expenseCategoriesFor("operator", categories).map((category) => category.label);
    assert.equal(forOperator.includes("Adelanto"), false);
    assert.equal(forOperator.includes("Retiro"), false);
  });

  it("un gasto en Retiro va a Resultado, con el aviso", () => {
    const repository = otherAgency();
    const retiro = find(repository, "Retiro")[0];
    assert.ok(retiro);
    assert.equal(categoryGoesToResult(listExpenseCategories(repository.load()), retiro.id), true);
    recordExpense(repository, { paidOn: "2026-09-04", categoryId: retiro.id, detail: "", amountCents: 10_000, month: "2026-09" });
    const month = summarizeMonth(repository.load(), "2026-09");
    assert.equal(month.partnerWithdrawalCents, 10_000);
    assert.equal(month.agencyExpenseCents, 0);
  });

  it("en Dolores no aparecen y agosto no cambia", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    assert.equal(find(repository, "Adelanto").length, 0);
    assert.equal(find(repository, "Retiro").length, 0);
    assert.equal(find(repository, "Adelanto Fede").length, 1);
    assert.deepEqual(summarizeMonth(repository.load()), before);
  });

  it("si el dueño ya tenía su propio Retiro, no se duplica", () => {
    const repository = otherAgency();
    const withOwn = createInMemoryLedgerRepository({
      ...repository.load(),
      expenseCategories: [{ id: "retiro", label: "Retiro", kind: "agency" }],
    });
    const retiros = find(withOwn, "Retiro");
    assert.equal(retiros.length, 1);
    assert.equal(retiros[0]?.id, "retiro");
    assert.equal(retiros[0]?.kind, "agency");
  });

  it("se pueden renombrar y quitar, y quitada no vuelve", () => {
    const repository = otherAgency();
    const adelanto = find(repository, "Adelanto")[0];
    assert.ok(adelanto);
    updateExpenseCategory(repository, { id: adelanto.id, label: "Adelanto dueño" });
    assert.equal(find(repository, "Adelanto dueño")[0]?.kind, "partner-withdrawal");
    removeExpenseCategory(repository, adelanto.id);
    assert.equal(find(repository, "Adelanto dueño").length, 0);
    assert.equal(find(repository, "Adelanto").length, 0);
  });
});

describe("sumar y quitar categorías según la necesidad", () => {
  const labels = (repository: ReturnType<typeof createInMemoryLedgerRepository>) =>
    listExpenseCategories(repository.load()).map((category) => category.label);
  const expenseIn = (categoryId: string) => ({ paidOn: "2026-09-04", categoryId, detail: "", amountCents: 10_000, month: "2026-09" });

  it("quitar una fija con gastos la saca de la lista y no cambia los totales", () => {
    const repository = createInMemoryLedgerRepository();
    recordExpense(repository, expenseIn("alquiler"));
    const before = summarizeMonth(repository.load(), "2026-09");
    removeExpenseCategory(repository, "alquiler");
    assert.equal(labels(repository).includes("Alquiler"), false);
    assert.deepEqual(summarizeMonth(repository.load(), "2026-09"), before);
    assert.equal(expenseCategoryLabel("alquiler", repository.load()), "Alquiler");
  });

  it("una fija renombrada conserva su nombre en los gastos al quitarla", () => {
    const repository = createInMemoryLedgerRepository();
    updateExpenseCategory(repository, { id: "alquiler", label: "Alquiler del local" });
    recordExpense(repository, expenseIn("alquiler"));
    removeExpenseCategory(repository, "alquiler");
    assert.equal(expenseCategoryLabel("alquiler", repository.load()), "Alquiler del local");
  });

  it("quitar una propia con gastos conserva su nombre y su tipo", () => {
    const repository = createInMemoryLedgerRepository();
    addExpenseCategory(repository, { label: "Seguro", kind: "partner-withdrawal" });
    recordExpense(repository, expenseIn("seguro"));
    removeExpenseCategory(repository, "seguro");
    assert.equal(labels(repository).includes("Seguro"), false);
    assert.equal(expenseCategoryLabel("seguro", repository.load()), "Seguro");
    assert.equal(summarizeMonth(repository.load(), "2026-09").partnerWithdrawalCents, 10_000);
  });

  it("quitar y volver a agregar una fija la devuelve sin duplicarla", () => {
    const repository = createInMemoryLedgerRepository();
    removeExpenseCategory(repository, "luz");
    assert.equal(labels(repository).includes("Luz"), false);
    const back = addExpenseCategory(repository, { label: " luz " });
    assert.equal(back.id, "luz");
    assert.equal(labels(repository).filter((label) => label === "Luz").length, 1);
    assert.equal((repository.load().expenseCategories ?? []).some((category) => category.id === "luz"), false);
  });

  it("una privada que vuelve sigue siendo privada aunque se elija pública", () => {
    const repository = createInMemoryLedgerRepository();
    addExpenseCategory(repository, { label: "Seguro", kind: "partner-withdrawal" });
    recordExpense(repository, expenseIn("seguro"));
    removeExpenseCategory(repository, "seguro");
    const back = addExpenseCategory(repository, { label: "Seguro", kind: "agency" });
    assert.equal(back.kind, "partner-withdrawal");
    assert.equal(listExpenseCategories(repository.load()).find((category) => category.id === "seguro")?.kind, "partner-withdrawal");
  });

  it("un gasto de una categoría quitada se edita, pero no se carga uno nuevo", () => {
    const repository = createInMemoryLedgerRepository();
    const expense = recordExpense(repository, expenseIn("alquiler"));
    removeExpenseCategory(repository, "alquiler");
    updateExpense(repository, { id: expense.id, paidOn: "2026-09-05", categoryId: "alquiler", detail: "", amountCents: 20_000 });
    assert.equal(summarizeMonth(repository.load(), "2026-09").agencyExpenseCents, 20_000);
    assert.throws(
      () => recordExpense(repository, expenseIn("alquiler")),
      (error: unknown) => error instanceof LedgerError && error.code === "unknown-category",
    );
  });

  it("en Dolores, quitar una categoría con gastos de agosto no mueve agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const before = summarizeMonth(repository.load());
    removeExpenseCategory(repository, "luz");
    removeExpenseCategory(repository, "adelanto-fede");
    assert.deepEqual(summarizeMonth(repository.load()), before);
  });

  it("el historial dice el nombre de una categoría quitada, no su id", () => {
    const repository = createInMemoryLedgerRepository();
    const expense = recordExpense(repository, expenseIn("cargas-sociales"));
    removeExpenseCategory(repository, "cargas-sociales");
    const before = repository.load();
    removeExpense(repository, expense.id);
    assert.match(describeLedgerChange(before, repository.load()) ?? "", /Cargas sociales/);
  });
});
