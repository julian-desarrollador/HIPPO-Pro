import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { LedgerError } from "../../domain/errors";
import { describeLedgerChange } from "./describe-ledger-change";
import { addBettor } from "./manage-bettors";
import { recordBettorPayment, recordBettorPlay } from "./mutate-bettor-ledger";
import { recordDay } from "./record-day";
import { saveCashDay } from "./save-cash-day";
import { saveScheduleDay } from "./save-schedule-day";
import { buildScheduleReport } from "./build-schedule-report";
import { summarizeCashDay } from "./summarize-cash-day";
import { summarizeMonth } from "./summarize-month";

const at = "2026-10-17T21:40:00.000Z";

describe("caja del día", () => {
  it("cierra la planilla del 17/10 y no mueve agosto", () => {
    const repository = createInMemoryLedgerRepository();
    const august = summarizeMonth(repository.load(), "2026-08");
    recordDay(repository, {
      date: "2026-10-17",
      racetrackId: "san-isidro",
      terminalId: "1",
      soldCents: 164_360_000,
      cancelledCents: 5_800_000,
      paidCents: 115_535_000,
    });
    const bettor = addBettor(repository, { name: "Ruso" });
    const other = addBettor(repository, { name: "Gaston" });
    recordBettorPayment(repository, { bettorId: bettor.id, date: "2026-10-17", amountCents: 440_000 });
    recordBettorPayment(repository, { bettorId: other.id, date: "2026-10-17", amountCents: 2_100_000 });
    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-10-17", amountCents: 23_390_000, payoutCents: 0 });
    const before = repository.load();
    saveCashDay(repository, {
      date: "2026-10-17",
      actorName: "Fede",
      at,
      openingCents: 102_834_900,
      commissionCents: 16_436_000,
      otherSalesCents: 0,
      salesTaxCents: 580_000,
      otherPaymentsCents: 0,
      bankOutCents: 0,
      personalWithdrawalCents: 0,
      incomes: [],
      expenses: [{ detail: "Almuerzo", amountCents: 1_850_000 }],
    });
    const summary = summarizeCashDay(repository.load(), "2026-10-17");
    assert.equal(summary.plusCents, 286_170_900);
    assert.equal(summary.minusCents, 147_155_000);
    assert.equal(summary.totalCents, 139_015_900);
    const later = summarizeMonth(repository.load(), "2026-08");
    assert.equal(later.netCents, august.netCents);
    assert.equal(later.billingCents, august.billingCents);
    assert.equal(later.outflowCents, august.outflowCents);
    assert.equal(later.balanceCents, august.balanceCents);
    assert.match(describeLedgerChange(before, repository.load()) ?? "", /Guardó la caja/);
  });

  it("arma la planilla del 17/10 con el borrador, antes de guardar", () => {
    const repository = createInMemoryLedgerRepository();
    recordDay(repository, {
      date: "2026-10-17",
      racetrackId: "san-isidro",
      terminalId: "1",
      soldCents: 164_360_000,
      cancelledCents: 5_800_000,
      paidCents: 115_535_000,
    });
    const bettor = addBettor(repository, { name: "Ruso" });
    const other = addBettor(repository, { name: "Gaston" });
    recordBettorPayment(repository, { bettorId: bettor.id, date: "2026-10-17", amountCents: 440_000 });
    recordBettorPayment(repository, { bettorId: other.id, date: "2026-10-17", amountCents: 2_100_000 });
    recordBettorPlay(repository, { bettorId: bettor.id, date: "2026-10-17", amountCents: 23_390_000, payoutCents: 0 });
    const summary = summarizeCashDay(repository.load(), "2026-10-17", {
      openingCents: 102_834_900,
      commissionCents: 16_436_000,
      otherSalesCents: 0,
      salesTaxCents: 580_000,
      otherPaymentsCents: 0,
      bankOutCents: 0,
      personalWithdrawalCents: 0,
      countedCents: null,
      incomes: [],
      expenses: [{ id: "almuerzo", detail: "Almuerzo", amountCents: 1_850_000 }],
    });
    assert.equal(summary.saved, false);
    assert.equal(summary.plusCents, 286_170_900);
    assert.equal(summary.minusCents, 147_155_000);
    assert.equal(summary.totalCents, 139_015_900);
    assert.equal(summary.differenceCents, null);
  });

  it("suma las dos terminales del mismo día", () => {
    const repository = createInMemoryLedgerRepository();
    recordDay(repository, {
      date: "2026-10-18",
      racetrackId: "san-isidro",
      terminalId: "1",
      soldCents: 100_000,
      cancelledCents: 10_000,
      paidCents: 20_000,
    });
    recordDay(repository, {
      date: "2026-10-18",
      racetrackId: "san-isidro",
      terminalId: "2",
      soldCents: 50_000,
      cancelledCents: 5_000,
      paidCents: 7_000,
    });
    const bettor = addBettor(repository, { name: "Ruso" });
    recordBettorPayment(repository, { bettorId: bettor.id, date: "2026-10-18", amountCents: 8_000 });
    const summary = summarizeCashDay(repository.load(), "2026-10-18");
    assert.equal(summary.plus.find((line) => line.key === "sold")?.cents, 150_000);
    assert.equal(summary.minus.find((line) => line.key === "cancelled")?.cents, 15_000);
    assert.equal(summary.minus.find((line) => line.key === "paid")?.cents, 27_000);
    assert.equal(summary.machine.length, 2);
    assert.equal(summary.machine[0]?.terminalId, "1");
    assert.equal(summary.machine[1]?.terminalId, "2");
    assert.equal(summary.machine[0]?.racetrackName, "San Isidro");
    assert.equal(summary.collections[0]?.bettorId, bettor.id);
    assert.equal(summary.minus.find((line) => line.key === "expenses")?.source, "de Gastos de la caja");
  });

  it("propone como inicio el total de la caja anterior", () => {
    const repository = createInMemoryLedgerRepository();
    saveCashDay(repository, {
      date: "2026-10-17",
      actorName: "Fede",
      at,
      openingCents: 102_834_900,
      commissionCents: 16_436_000,
      otherSalesCents: 0,
      salesTaxCents: 580_000,
      otherPaymentsCents: 0,
      bankOutCents: 0,
      personalWithdrawalCents: 0,
      incomes: [],
      expenses: [{ detail: "Almuerzo", amountCents: 1_850_000 }],
    });
    recordDay(repository, {
      date: "2026-10-17",
      racetrackId: "san-isidro",
      soldCents: 164_360_000,
      cancelledCents: 5_800_000,
      paidCents: 115_535_000,
    });
    const closed = summarizeCashDay(repository.load(), "2026-10-17");
    const next = summarizeCashDay(repository.load(), "2026-10-18");
    assert.equal(next.suggestedOpeningCents, closed.totalCents);
    assert.equal(next.openingCents, closed.totalCents);
  });

  it("separa el efectivo del banco del otro efectivo y guarda quién lo cargó", () => {
    const repository = createInMemoryLedgerRepository();
    const before = repository.load();
    const saved = saveCashDay(repository, {
      date: "2026-10-17",
      actorName: "Fede",
      at,
      openingCents: 0,
      commissionCents: 0,
      otherSalesCents: 0,
      salesTaxCents: 0,
      otherPaymentsCents: 0,
      bankOutCents: 0,
      personalWithdrawalCents: 0,
      incomes: [
        { id: "banco", kind: "bank", detail: "Cajero", amountCents: 5_000_000 },
        { id: "otro", kind: "other", detail: "", amountCents: 1_000_000 },
      ],
      expenses: [],
    });
    const summary = summarizeCashDay(repository.load(), "2026-10-17");
    assert.equal(summary.plus.find((line) => line.key === "bank-in")?.cents, 5_000_000);
    assert.equal(summary.plus.find((line) => line.key === "other-in")?.cents, 1_000_000);
    assert.equal(summary.incomeTotalCents, 6_000_000);
    assert.equal(summary.totalCents, 6_000_000);
    const bank = saved.incomes.find((income) => income.kind === "bank");
    assert.equal(bank?.createdBy, "Fede");
    assert.equal(bank?.updatedBy, undefined);
    const editedBefore = repository.load();
    const edited = saveCashDay(repository, {
      date: "2026-10-17",
      actorName: "Mati",
      at: "2026-10-17T22:10:00.000Z",
      openingCents: 0,
      commissionCents: 0,
      otherSalesCents: 0,
      salesTaxCents: 0,
      otherPaymentsCents: 0,
      bankOutCents: 0,
      personalWithdrawalCents: 0,
      incomes: saved.incomes.map((income) =>
        income.kind === "bank" ? { id: income.id, kind: income.kind, detail: income.detail, amountCents: 4_000_000 } : income,
      ),
      expenses: [],
    });
    const changed = edited.incomes.find((income) => income.kind === "bank");
    assert.equal(changed?.createdBy, "Fede");
    assert.equal(changed?.updatedBy, "Mati");
    const first = describeLedgerChange(before, editedBefore) ?? "";
    assert.match(first, /en efectivo del banco/);
    assert.match(first, /en otro efectivo/);
    const editedText = describeLedgerChange(editedBefore, repository.load()) ?? "";
    assert.match(editedText, /Cambió un ingreso de/);
    assert.match(editedText, /efectivo del banco/);
  });
});

describe("calendario", () => {
  it("nombra el hipódromo, las personas y el día sin actividad", () => {
    const repository = createInMemoryLedgerRepository();
    saveScheduleDay(repository, {
      date: "2026-10-01",
      racetrackIds: ["san-isidro"],
      people: [{ id: "ana", name: "Ana" }],
      inactive: false,
    });
    saveScheduleDay(repository, {
      date: "2026-10-02",
      racetrackIds: ["palermo"],
      people: [
        { id: "ana", name: "Ana" },
        { id: "luis", name: "Luis" },
      ],
      inactive: false,
    });
    saveScheduleDay(repository, { date: "2026-10-06", racetrackIds: [], people: [], inactive: true });
    const report = buildScheduleReport(repository.load(), "2026-10", "Agencia Dolores");
    assert.match(report ?? "", /HippoPro · Agencia Dolores · Octubre 2026/);
    assert.match(report ?? "", /Jue 1 · San Isidro · Ana/);
    assert.match(report ?? "", /Vie 2 · Palermo · Ana, Luis/);
    assert.match(report ?? "", /Mar 6 · Sin actividad/);
    assert.throws(
      () => saveScheduleDay(repository, { date: "2026-10-03", racetrackIds: ["san-isidro"], people: [], inactive: false }),
      (error: unknown) => error instanceof LedgerError && error.code === "schedule-person-required",
    );
  });
});
