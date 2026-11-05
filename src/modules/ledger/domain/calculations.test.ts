import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canViewAgencyBalances } from "./access";
import { settleDay } from "./calculations";
import { EXPENSE_CATEGORIES, categoryGoesToResult, expenseCategoriesFor } from "./expense-categories";
import { formatCents, formatSignedPercent } from "./money";
import { RACETRACKS, commissionModeOf, racetrackRates } from "./racetracks";

describe("settleDay", () => {
  it("en San Isidro cobra el 15% y resta el 5% del neto al depositar", () => {
    const day = settleDay({
      racetrackId: "san-isidro",
      soldCents: 307_384_000,
      cancelledCents: 7_560_000,
      paidCents: 224_704_250,
    });

    assert.equal(day.netCents, 299_824_000);
    assert.equal(day.commissionCents, 44_973_600);
    assert.equal(day.adjustmentCents, -14_991_200);
    assert.equal(day.amountToDepositCents, 60_128_550);
    assert.equal(day.commissionBasisPoints, 1500);
    assert.equal(day.depositAdjustmentBasisPoints, -500);
  });

  it("si el día trae su comisión, no usa la de la tabla, y el ajuste sigue fijo", () => {
    const day = settleDay({
      racetrackId: "san-isidro",
      soldCents: 10_000,
      cancelledCents: 0,
      paidCents: 0,
      commissionBasisPoints: 2000,
    });

    assert.equal(day.commissionCents, 2_000);
    assert.equal(day.adjustmentCents, -500);
    assert.equal(day.commissionBasisPoints, 2000);
    assert.equal(day.depositAdjustmentBasisPoints, -500);
  });

  it("en Palermo cobra el 9% y suma el 1% del neto al depositar", () => {
    const day = settleDay({
      racetrackId: "palermo",
      soldCents: 547_864_500,
      cancelledCents: 1_104_500,
      paidCents: 166_719_000,
    });

    assert.equal(day.netCents, 546_760_000);
    assert.equal(day.commissionCents, 49_208_400);
    assert.equal(day.adjustmentCents, 5_467_600);
    assert.equal(day.amountToDepositCents, 385_508_600);
    assert.ok(day.adjustmentCents > 0);
  });

  it("en La Plata cobra el 15% y resta el 5% del neto al depositar", () => {
    const day = settleDay({
      racetrackId: "la-plata",
      soldCents: 87_783_100,
      cancelledCents: 38_900_000,
      paidCents: 34_962_500,
    });

    assert.equal(day.netCents, 48_883_100);
    assert.equal(day.commissionCents, 7_332_465);
    assert.equal(day.adjustmentCents, -2_444_155);
    assert.equal(day.amountToDepositCents, 11_476_445);
    assert.ok(day.adjustmentCents < 0);
  });

  it("en La Plata, 233 vendido menos 1 cancelado da neto 232 y a depositar 207,40", () => {
    const day = settleDay({
      racetrackId: "la-plata",
      soldCents: 23_300,
      cancelledCents: 100,
      paidCents: 1_300,
    });

    assert.equal(day.netCents, 23_200);
    assert.equal(day.commissionCents, 3_480);
    assert.equal(day.adjustmentCents, -1_160);
    assert.equal(day.amountToDepositCents, 20_740);
  });
});

describe("canViewAgencyBalances", () => {
  it("el operador no ve los saldos de la agencia", () => {
    assert.equal(canViewAgencyBalances("operator"), false);
    assert.equal(canViewAgencyBalances("owner"), true);
  });
});

describe("expenseCategoriesFor", () => {
  it("el operador no ve las categorías de adelantos y retiros de los dueños", () => {
    const operator = expenseCategoriesFor("operator", EXPENSE_CATEGORIES);
    assert.ok(operator.length > 0);
    assert.ok(operator.every((category) => category.kind === "agency"));
    assert.ok(!operator.some((category) => category.id === "retiro-sag-fede" || category.id === "adelanto-mati"));
  });

  it("el dueño ve todas las categorías", () => {
    assert.equal(expenseCategoriesFor("owner", EXPENSE_CATEGORIES).length, EXPENSE_CATEGORIES.length);
  });
});

describe("formatCents", () => {
  it("muestra los centavos con separador argentino", () => {
    assert.match(formatCents(804_206_625), /8\.042\.066,25/);
  });
});

describe("formatSignedPercent", () => {
  it("escribe la comisión sin signo y el ajuste con signo", () => {
    assert.equal(formatSignedPercent(1500), "15 %");
    assert.equal(formatSignedPercent(-500), "−5 %");
    assert.equal(formatSignedPercent(100), "+1 %");
  });

  it("usa coma para los decimales", () => {
    assert.equal(formatSignedPercent(1350), "13,5 %");
    assert.equal(formatSignedPercent(1460), "14,6 %");
  });
});

describe("comisión descontada del depósito", () => {
  const retained = (soldCents: number, paidCents: number) =>
    settleDay({
      racetrackId: "nuevo",
      soldCents,
      cancelledCents: 0,
      paidCents,
      ...racetrackRates("retained", 675, 0, 2000),
    });

  it("el ejemplo de Federico: 6,75% del neto más 20% de la ganancia menos su 6,75%", () => {
    const day = retained(100_000_000, 60_000_000);
    assert.equal(day.dayGainCents, 40_000_000);
    assert.equal(day.netShareCents, 6_750_000);
    assert.equal(day.profitShareBaseCents, 37_300_000);
    assert.equal(day.profitShareCents, 7_460_000);
    assert.equal(day.commissionCents, 14_210_000);
    assert.equal(day.amountToDepositCents, 25_790_000);
  });

  it("si se pagó más de lo vendido, el 20% queda en cero y la agencia cobra solo el 6,75% del neto", () => {
    const day = retained(100_000_000, 120_000_000);
    assert.equal(day.dayGainCents, -20_000_000);
    assert.equal(day.profitShareBaseCents, 0);
    assert.equal(day.profitShareCents, 0);
    assert.equal(day.commissionCents, 6_750_000);
    assert.equal(day.amountToDepositCents, -26_750_000);
  });

  it("sin la parte de la ganancia se calcula igual que antes", () => {
    const day = settleDay({ racetrackId: "san-isidro", soldCents: 1_000_000, cancelledCents: 0, paidCents: 400_000 });
    assert.equal(day.commissionCents, 150_000);
    assert.equal(day.amountToDepositCents, 550_000);
    assert.equal(day.profitShareBasisPoints, undefined);
    assert.equal(day.profitShareCents, 0);
  });

  it("el modo sale de la parte de la ganancia", () => {
    assert.equal(commissionModeOf({ profitShareBasisPoints: 2000 }), "retained");
    assert.equal(commissionModeOf({ profitShareBasisPoints: 0 }), "retained");
    assert.equal(commissionModeOf({}), "fixed");
    for (const racetrack of RACETRACKS) {
      assert.equal(commissionModeOf(racetrack), "fixed", racetrack.name);
    }
  });

  it("cada modo guarda solo sus porcentajes", () => {
    assert.deepEqual(racetrackRates("fixed", 1500, -500, 2000), { commissionBasisPoints: 1500, depositAdjustmentBasisPoints: -500 });
    assert.deepEqual(racetrackRates("retained", 675, -500, 2000), {
      commissionBasisPoints: 675,
      depositAdjustmentBasisPoints: 0,
      profitShareBasisPoints: 2000,
    });
  });
});

describe("adónde va un gasto", () => {
  it("los adelantos y retiros van a Resultado, los gastos comunes no", () => {
    assert.equal(categoryGoesToResult(EXPENSE_CATEGORIES, "adelanto-fede"), true);
    assert.equal(categoryGoesToResult(EXPENSE_CATEGORIES, "retiro-sag-mati"), true);
    assert.equal(categoryGoesToResult(EXPENSE_CATEGORIES, "sueldo"), false);
  });

  it("una categoría que no existe no avisa nada", () => {
    assert.equal(categoryGoesToResult(EXPENSE_CATEGORIES, "no-existe"), false);
  });
});
