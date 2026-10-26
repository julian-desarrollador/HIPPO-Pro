import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { createInMemoryLotteryRepository } from "../../adapters/outbound/in-memory-lottery-repository";
import { LedgerError } from "../../domain/errors";
import { activateLottery } from "./lottery-activate";
import { summarizeLotteryMonth } from "./lottery-summary";
import { summarizeMonth } from "./summarize-month";
import { summarizeAgencyAccount } from "./agency-account";
import { listAgencyDays, previewAgencyDay, recordAgencyDay, removeAgencyDay, updateAgencyDay } from "./agency-day";

const at = "2026-10-21T22:00:00.000Z";

function books() {
  const lottery = createInMemoryLotteryRepository();
  activateLottery(lottery, { agencyId: "agencia-dolores", role: "owner", actorName: "Fede", at, month: "2026-10" });
  const racing = createInMemoryLedgerRepository();
  return { lottery, racing };
}

function hasCode(code: LedgerError["code"]) {
  return (error: unknown) => error instanceof LedgerError && error.code === code;
}

describe("cuenta única de la agencia", () => {
  it("la cuenta es la boleta y no suma el libro por hipódromo", () => {
    const { lottery, racing } = books();
    const august = summarizeMonth(racing.load(), "2026-08");
    recordAgencyDay(lottery, racing, {
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "quiniela-ciudad", soldCents: 100_000, prizesCents: 10_000, cancelledCents: 0 }],
      tracks: [
        { racetrackId: "san-isidro", soldCents: 100_000, cancelledCents: 0, paidCents: 0 },
        { racetrackId: "palermo", soldCents: 0, cancelledCents: 0, paidCents: 0 },
      ],
    });
    const account = summarizeAgencyAccount(summarizeLotteryMonth(lottery.load()!, "2026-10"));

    assert.equal(account.products[0]?.name, "Quiniela Ciudad");
    assert.equal(account.products[0]?.commissionCents, 20_000);
    assert.equal(account.products[0]?.amountToDepositCents, 70_000);
    assert.equal(account.products.some((product) => product.name === "Hípica"), true);
    assert.equal(account.netCents, 100_000);
    assert.equal(account.commissionCents, 20_000);
    assert.equal(account.owedCents, 70_000);
    assert.deepEqual(summarizeMonth(racing.load(), "2026-08"), august);
    assert.equal(racing.load().days.filter((day) => day.date === "2026-10-21").length, 1);
  });

  it("la hípica de la boleta no sale del libro por hipódromo", () => {
    const { lottery } = books();
    recordAgencyDay(lottery, null, {
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "quiniela-ciudad", soldCents: 100_000 }],
      tracks: null,
    });
    const account = summarizeAgencyAccount(summarizeLotteryMonth(lottery.load()!, "2026-10"));
    assert.equal(account.products.find((product) => product.id === "hipica")?.soldCents, 0);
    assert.equal(account.netCents, 100_000);
    assert.equal(account.owedCents, 80_000);
  });
});

describe("carga única", () => {
  it("un botón guarda los dos libros y saltea el hipódromo vacío", () => {
    const { lottery, racing } = books();
    const ids = recordAgencyDay(lottery, racing, {
      date: "2026-10-21",
      terminalId: "2",
      amounts: [{ gameId: "loto-plus", soldCents: 50_000 }],
      tracks: [
        { racetrackId: "san-isidro", soldCents: 0, cancelledCents: 0, paidCents: 0 },
        { racetrackId: "la-plata", soldCents: 40_000, cancelledCents: 0, paidCents: 10_000 },
      ],
    });
    assert.equal(ids.length, 1);
    assert.equal(lottery.load()!.sales.length, 1);
    assert.equal(racing.load().days.some((day) => day.date === "2026-10-21" && day.racetrackId === "san-isidro"), false);
    const preview = previewAgencyDay(
      lottery.load()!,
      racing.load(),
      {
        date: "2026-10-21",
        terminalId: "2",
        amounts: [{ gameId: "loto-plus", soldCents: 50_000 }],
        tracks: [{ racetrackId: "la-plata", soldCents: 40_000, cancelledCents: 0, paidCents: 10_000 }],
      },
      { date: "2026-10-21", terminalId: "2" },
    );
    assert.equal(preview.tracks.length, 1);
    assert.ok(preview.netCents > 0);
    const rows = listAgencyDays(lottery.load()!, racing.load(), "2026-10");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.terminalId, "2");
    assert.equal(rows[0]?.soldByGame["loto-plus"], 50_000);
    assert.ok((rows[0]?.racingNetCents ?? 0) > 0);
  });

  it("sin ningún importe no guarda ninguno de los dos", () => {
    const { lottery, racing } = books();
    const before = JSON.stringify(racing.load());
    assert.throws(
      () =>
        recordAgencyDay(lottery, racing, {
          date: "2026-10-21",
          terminalId: "1",
          amounts: [{ gameId: "quiniela-ciudad", soldCents: 0 }],
          tracks: [{ racetrackId: "san-isidro", soldCents: 0, cancelledCents: 0, paidCents: 0 }],
        }),
      hasCode("empty-entry"),
    );
    assert.equal(lottery.load()!.sales.length, 0);
    assert.equal(JSON.stringify(racing.load()), before);
  });

  it("editar saca el hipódromo que quedó vacío y deja el juego", () => {
    const { lottery, racing } = books();
    recordAgencyDay(lottery, racing, {
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "quiniela-ciudad", soldCents: 100_000 }],
      tracks: [{ racetrackId: "san-isidro", soldCents: 80_000, cancelledCents: 0, paidCents: 0 }],
    });
    updateAgencyDay(lottery, racing, {
      fromDate: "2026-10-21",
      fromTerminalId: "1",
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "quiniela-ciudad", soldCents: 120_000 }],
      tracks: [{ racetrackId: "san-isidro", soldCents: 0, cancelledCents: 0, paidCents: 0 }],
    });
    assert.equal(lottery.load()!.sales[0]?.soldCents, 120_000);
    assert.equal(racing.load().days.some((day) => day.date === "2026-10-21"), false);
  });

  it("quitar saca el día de los dos libros", () => {
    const { lottery, racing } = books();
    recordAgencyDay(lottery, racing, {
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "loto-plus", soldCents: 10_000 }],
      tracks: [{ racetrackId: "palermo", soldCents: 10_000, cancelledCents: 0, paidCents: 0 }],
    });
    removeAgencyDay(lottery, racing, { date: "2026-10-21", terminalId: "1" });
    assert.equal(lottery.load()!.sales.length, 0);
    assert.equal(racing.load().days.some((day) => day.date === "2026-10-21"), false);
  });

  it("si la hípica falla después de guardar la quiniela, avisa y la quiniela queda", () => {
    const { lottery, racing } = books();
    racing.save = () => {
      throw new Error("boom");
    };
    assert.throws(
      () =>
        recordAgencyDay(lottery, racing, {
          date: "2026-10-21",
          terminalId: "1",
          amounts: [{ gameId: "quiniela-ciudad", soldCents: 10_000 }],
          tracks: [{ racetrackId: "san-isidro", soldCents: 10_000, cancelledCents: 0, paidCents: 0 }],
        }),
      hasCode("agency-day-partial"),
    );
    assert.equal(lottery.load()!.sales.length, 1);
  });
});
