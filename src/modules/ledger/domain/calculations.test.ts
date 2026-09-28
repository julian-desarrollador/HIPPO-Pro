import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canViewAgencyBalances } from "./access";
import { settleDay } from "./calculations";
import { formatCents } from "./money";

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
    assert.equal(day.amountToDepositCents, 60_128_550);
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
    assert.equal(day.amountToDepositCents, 385_508_600);
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
    assert.equal(day.amountToDepositCents, 11_476_445);
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
