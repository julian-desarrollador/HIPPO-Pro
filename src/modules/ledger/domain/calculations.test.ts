import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canViewAgencyBalances } from "./access";
import { settleDay } from "./calculations";
import { formatCents, formatSignedPercent } from "./money";

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
});
