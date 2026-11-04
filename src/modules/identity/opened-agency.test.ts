import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLotteryRepository } from "../ledger/adapters/outbound/in-memory-lottery-repository";
import { createEmptyAgencySnapshot } from "../ledger/adapters/outbound/starting-snapshot";
import { activateLottery } from "../ledger/application/use-cases/lottery-activate";
import { openedAgencyFrom } from "./opened-agency";

function lotteryBook(agencyId: string) {
  return activateLottery(createInMemoryLotteryRepository(), {
    agencyId,
    role: "owner",
    actorName: "Sergio",
    at: "2026-11-04T12:00:00.000Z",
    month: "2026-11",
  });
}

describe("abrir otra agencia en solo lectura", () => {
  it("trae el libro de lotería cuando la agencia tiene uno", () => {
    const opened = openedAgencyFrom(
      {
        name: " Lavalle 1442 ",
        productMode: "lottery",
        snapshot: createEmptyAgencySnapshot("lavalle-1442"),
        lotterySnapshot: lotteryBook("lavalle-1442"),
      },
      "lavalle-1442",
    );
    assert.equal(opened?.agencyName, "Lavalle 1442");
    assert.equal(opened?.agencyMode, "lottery");
    assert.equal(opened?.lotterySnapshot?.agencyId, "lavalle-1442");
  });

  it("una agencia solo de hípica abre sin libro de lotería", () => {
    const opened = openedAgencyFrom(
      { name: "Norte", productMode: "racing", snapshot: createEmptyAgencySnapshot("norte"), lotterySnapshot: null },
      "norte",
    );
    assert.equal(opened?.agencyMode, "racing");
    assert.equal(opened?.lotterySnapshot, null);
  });

  it("descarta un libro de lotería de otra agencia", () => {
    const opened = openedAgencyFrom(
      {
        name: "Norte",
        productMode: "both",
        snapshot: createEmptyAgencySnapshot("norte"),
        lotterySnapshot: lotteryBook("sur"),
      },
      "norte",
    );
    assert.notEqual(opened, null);
    assert.equal(opened?.lotterySnapshot, null);
  });

  it("sin un libro de hípica válido no abre", () => {
    assert.equal(openedAgencyFrom({ name: "Norte", snapshot: { agencyId: "norte" } }, "norte"), null);
    assert.equal(openedAgencyFrom({ name: "Norte", snapshot: createEmptyAgencySnapshot("sur") }, "norte"), null);
    assert.equal(openedAgencyFrom({ name: "  ", snapshot: createEmptyAgencySnapshot("norte") }, "norte"), null);
    assert.equal(openedAgencyFrom(null, "norte"), null);
  });
});
