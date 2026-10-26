import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { createInMemoryLotteryRepository } from "../../adapters/outbound/in-memory-lottery-repository";
import { lotterySync, openLotteryLedger, type LotteryRemote } from "../../adapters/outbound/lottery-ledger";
import type { LedgerRemoteRow } from "../../adapters/outbound/agency-ledger";
import { LedgerError } from "../../domain/errors";
import { LOTTERY_GAMES, settleLotterySale, withTicketGames, type LotterySnapshot } from "../../domain/lottery";
import { activateLottery } from "./lottery-activate";
import { describeLotteryChange, withLotteryAudit } from "./lottery-audit";
import { recordLotteryDeposit, removeLotteryDeposit } from "./lottery-deposits";
import { recordLotteryExpense } from "./lottery-expenses";
import { updateLotteryCommission } from "./lottery-games";
import { previewLotteryDay, recordLotteryDay, removeLotteryDay, updateLotteryDay } from "./lottery-sales";
import { combineAgencyMonth, listLotteryDays, summarizeLotteryMonth } from "./lottery-summary";
import { summarizeMonth } from "./summarize-month";

const at = "2026-10-21T22:00:00.000Z";

function activeRepository() {
  const repository = createInMemoryLotteryRepository();
  activateLottery(repository, { agencyId: "agencia-dolores", role: "owner", actorName: "Fede", at, month: "2026-10" });
  return repository;
}

const hundredThousandEach = LOTTERY_GAMES.map((game) => ({ gameId: game.id, soldCents: 10_000_000 }));

function hasCode(code: LedgerError["code"]) {
  return (error: unknown) => error instanceof LedgerError && error.code === code;
}

describe("quiniela: activar", () => {
  it("el dueño la activa con los juegos de la boleta y el saldo en cero", () => {
    const repository = activeRepository();
    const snapshot = repository.load();
    assert.ok(snapshot);
    assert.deepEqual(
      snapshot.games.map((game) => [game.name, game.commissionBasisPoints]),
      LOTTERY_GAMES.map((game) => [game.name, game.commissionBasisPoints]),
    );
    assert.equal(snapshot.openingCents, 0);
    assert.equal(snapshot.audit.length, 1);
    assert.equal(snapshot.audit[0]?.summary, "Activó la quiniela.");
    assert.equal(snapshot.audit[0]?.actorName, "Fede");
  });

  it("un operador no la puede activar", () => {
    const repository = createInMemoryLotteryRepository();
    assert.throws(
      () => activateLottery(repository, { agencyId: "agencia-dolores", role: "operator", actorName: "Op", at, month: "2026-10" }),
      hasCode("lottery-owner-only"),
    );
    assert.equal(repository.load(), null);
  });

  it("sin activar no se puede cargar", () => {
    const repository = createInMemoryLotteryRepository();
    assert.throws(
      () => recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach }),
      hasCode("lottery-inactive"),
    );
  });
});

describe("quiniela: cuentas", () => {
  it("la comisión sale de las apuestas y a depositar resta premios y anulaciones", () => {
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach });
    const summary = summarizeLotteryMonth(repository.load()!, "2026-10");
    assert.deepEqual(
      summary.games.map((game) => game.name),
      ["Quiniela Ciudad", "Quini 6", "Loto Plus", "Quiniela Poceada", "Hípica", "Loto 5 Plus", "Brinco"],
    );
    assert.deepEqual(
      summary.games.map((game) => game.commissionCents),
      [2_000_000, 1_400_000, 1_400_000, 2_000_000, 0, 1_400_000, 1_400_000],
    );
    assert.equal(summary.soldCents, 70_000_000);
    assert.equal(summary.commissionCents, 9_600_000);
    assert.equal(summary.amountToDepositCents, 60_400_000);
    assert.equal(summary.owedCents, 60_400_000);
    assert.deepEqual(
      settleLotterySale({ soldCents: 11_200_000, prizesCents: 0, cancelledCents: 400_000, commissionBasisPoints: 1400 }),
      { commissionCents: 1_568_000, amountToDepositCents: 9_232_000 },
    );
  });

  it("un juego viejo con ventas queda en el saldo y no en la tabla", () => {
    const repository = activeRepository();
    const snapshot = repository.load()!;
    repository.save({
      ...snapshot,
      games: [
        { id: "quiniela", name: "Quiniela", commissionBasisPoints: 2000 },
        { id: "plus", name: "Plus", commissionBasisPoints: 2000 },
        { id: "telekino", name: "Telekino", commissionBasisPoints: 1500 },
      ],
      sales: [
        {
          id: "sale-plus",
          agencyId: snapshot.agencyId,
          date: "2026-10-21",
          terminalId: "1",
          gameId: "plus",
          soldCents: 1_000_000,
          prizesCents: 0,
          cancelledCents: 0,
          commissionBasisPoints: 2000,
        },
      ],
    });
    const aligned = withTicketGames(repository.load()!);
    assert.equal(aligned.games.some((game) => game.id === "telekino"), false);
    assert.equal(aligned.games.at(-1)?.name, "Plus");
    assert.deepEqual(
      aligned.games.slice(0, 7).map((game) => game.id),
      LOTTERY_GAMES.map((game) => game.id),
    );
    const summary = summarizeLotteryMonth(aligned, "2026-10");
    assert.equal(summary.games.some((game) => game.gameId === "plus"), false);
    assert.equal(summary.soldCents, 1_000_000);
    assert.equal(summary.commissionCents, 200_000);
    assert.equal(withTicketGames(aligned), aligned);
  });

  it("el saldo con la lotería resta los depósitos y pasa al mes siguiente", () => {
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: [{ gameId: "quiniela-ciudad", soldCents: 10_000_000 }] });
    recordLotteryDeposit(repository, { date: "2026-10-22", amountCents: 5_000_000 });
    const october = summarizeLotteryMonth(repository.load()!, "2026-10");
    assert.equal(october.openingCents, 0);
    assert.equal(october.amountToDepositCents, 8_000_000);
    assert.equal(october.depositsCents, 5_000_000);
    assert.equal(october.owedCents, 3_000_000);
    const november = summarizeLotteryMonth(repository.load()!, "2026-11");
    assert.equal(november.openingCents, 3_000_000);
    assert.equal(november.owedCents, 3_000_000);
  });

  it("la misma terminal no se carga dos veces el mismo día, otra terminal sí", () => {
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach });
    assert.throws(
      () => recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach }),
      hasCode("duplicate-lottery-day"),
    );
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "2", amounts: [{ gameId: "loto-plus", soldCents: 500_000 }] });
    const days = listLotteryDays(repository.load()!, "2026-10");
    assert.deepEqual(
      days.map((day) => [day.terminalId, day.soldCents]),
      [
        ["1", 70_000_000],
        ["2", 500_000],
      ],
    );
  });

  it("editar reemplaza lo de esa terminal y conserva el porcentaje ya cargado", () => {
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: [{ gameId: "loto-plus", soldCents: 10_000_000 }] });
    updateLotteryCommission(repository, { gameId: "loto-plus", commissionBasisPoints: 1500 });
    updateLotteryDay(repository, {
      fromDate: "2026-10-21",
      fromTerminalId: "1",
      date: "2026-10-21",
      terminalId: "1",
      amounts: [
        { gameId: "loto-plus", soldCents: 20_000_000 },
        { gameId: "brinco", soldCents: 10_000_000 },
      ],
    });
    const sales = repository.load()!.sales;
    assert.equal(sales.length, 2);
    assert.equal(sales.find((sale) => sale.gameId === "loto-plus")?.commissionBasisPoints, 1400);
    assert.equal(sales.find((sale) => sale.gameId === "brinco")?.commissionBasisPoints, 1400);
    const preview = previewLotteryDay(repository.load()!, [{ gameId: "loto-plus", soldCents: 10_000_000 }]);
    assert.equal(preview.commissionCents, 1_500_000);
    removeLotteryDay(repository, { date: "2026-10-21", terminalId: "1" });
    assert.equal(repository.load()!.sales.length, 0);
  });

  it("sin ningún importe no guarda, y solo premios sí", () => {
    const repository = activeRepository();
    assert.throws(
      () => recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: [{ gameId: "quiniela-ciudad", soldCents: 0 }] }),
      hasCode("empty-entry"),
    );
    recordLotteryDay(repository, {
      date: "2026-10-21",
      terminalId: "1",
      amounts: [{ gameId: "quiniela-ciudad", soldCents: 0, prizesCents: 170_000, cancelledCents: 0 }],
    });
    assert.equal(repository.load()!.sales[0]?.prizesCents, 170_000);
    assert.equal(repository.load()!.sales[0]?.soldCents, 0);
    assert.throws(
      () => recordLotteryDay(repository, { date: "2026-10-21", terminalId: "5", amounts: hundredThousandEach }),
      hasCode("unknown-terminal"),
    );
  });

  it("gastos y retiros de quiniela bajan su saldo del mes", () => {
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: [{ gameId: "quiniela-ciudad", soldCents: 10_000_000 }] });
    recordLotteryExpense(repository, { month: "2026-10", paidOn: "2026-10-21", kind: "agency", detail: "Papel", amountCents: 300_000 });
    recordLotteryExpense(repository, { month: "2026-10", paidOn: "2026-10-21", kind: "partner-withdrawal", detail: "", amountCents: 200_000 });
    const summary = summarizeLotteryMonth(repository.load()!, "2026-10");
    assert.equal(summary.agencyExpenseCents, 300_000);
    assert.equal(summary.partnerWithdrawalCents, 200_000);
    assert.equal(summary.balanceCents, 2_000_000 - 500_000);
  });
});

describe("quiniela: la hípica no cambia", () => {
  it("cargar quiniela no toca el libro de hípica ni los totales de agosto", () => {
    const racing = createInMemoryLedgerRepository();
    const before = JSON.stringify(racing.load());
    const august = summarizeMonth(racing.load(), "2026-08");
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-08-10", terminalId: "1", amounts: hundredThousandEach });
    const deposit = recordLotteryDeposit(repository, { date: "2026-08-11", amountCents: 1_000_000 });
    removeLotteryDeposit(repository, deposit.id);
    recordLotteryExpense(repository, { month: "2026-08", paidOn: "2026-08-12", kind: "agency", detail: "", amountCents: 100_000 });
    assert.equal(JSON.stringify(racing.load()), before);
    assert.deepEqual(summarizeMonth(racing.load(), "2026-08"), august);
  });

  it("el total de la agencia suma hípica y quiniela sin cambiar la hípica", () => {
    const august = summarizeMonth(createInMemoryLedgerRepository().load(), "2026-08");
    const repository = activeRepository();
    recordLotteryDay(repository, { date: "2026-08-10", terminalId: "1", amounts: [{ gameId: "quiniela-ciudad", soldCents: 10_000_000 }] });
    const month = combineAgencyMonth(august, summarizeLotteryMonth(repository.load()!, "2026-08"));
    assert.equal(month.racing.earningsCents, august.billingCents);
    assert.equal(month.racing.balanceCents, august.balanceCents);
    assert.equal(month.lottery.earningsCents, 2_000_000);
    assert.equal(month.total.earningsCents, august.billingCents + 2_000_000);
    assert.equal(month.total.balanceCents, august.balanceCents + 2_000_000);
  });
});

describe("quiniela: historial", () => {
  it("anota la carga, el depósito y el cambio de porcentaje", () => {
    const repository = activeRepository();
    const before = repository.load()!;
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: [{ gameId: "quiniela-ciudad", soldCents: 10_000_000 }] });
    recordLotteryDeposit(repository, { date: "2026-10-22", amountCents: 5_000_000 });
    updateLotteryCommission(repository, { gameId: "loto-plus", commissionBasisPoints: 1500 });
    const summary = describeLotteryChange(before, repository.load()!);
    assert.match(summary ?? "", /Cargó la quiniela del 21\/10\/2026 en Terminal 1/);
    assert.match(summary ?? "", /Cargó un depósito de .* a la lotería\./);
    assert.match(summary ?? "", /Cambió la comisión de Loto Plus de 14 % a 15 %\./);
    const audited = withLotteryAudit(before, repository.load()!, "operator", at, "Mati");
    assert.equal(audited.audit.length, 2);
    assert.equal(audited.audit[1]?.actorName, "Mati");
  });
});

function createFakeRemote(initial: LedgerRemoteRow | null) {
  let row = initial ? structuredClone(initial) : null;
  const remote: LotteryRemote & { stored: () => LedgerRemoteRow | null; diverge: (version: number) => void } = {
    stored: () => (row ? structuredClone(row) : null),
    diverge(version) {
      if (row) {
        row = { snapshot: row.snapshot, version };
      }
    },
    async read() {
      return row ? structuredClone(row) : null;
    },
    async insert(_agencyId: string, snapshot: LotterySnapshot) {
      if (row) {
        return "exists" as const;
      }
      row = { snapshot: structuredClone(snapshot), version: 1 };
      return "created" as const;
    },
    async update(_agencyId: string, snapshot: LotterySnapshot, expectedVersion: number) {
      if (!row || row.version !== expectedVersion) {
        return "conflict" as const;
      }
      row = { snapshot: structuredClone(snapshot), version: expectedVersion + 1 };
      return expectedVersion + 1;
    },
  };
  return remote;
}

describe("quiniela: libro en la base", () => {
  it("sin fila no está activada, y activar crea la fila", async () => {
    const remote = createFakeRemote(null);
    const repository = await openLotteryLedger(remote, "agencia-dolores");
    assert.equal(repository.load(), null);
    activateLottery(repository, { agencyId: "agencia-dolores", role: "owner", actorName: "Fede", at, month: "2026-10" });
    await lotterySync(repository);
    assert.equal(remote.stored()?.version, 1);
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach });
    await lotterySync(repository);
    assert.equal(remote.stored()?.version, 2);
  });

  it("si otro guardó antes, avisa el conflicto y vuelve a lo guardado", async () => {
    const remote = createFakeRemote(null);
    const repository = await openLotteryLedger(remote, "agencia-dolores");
    activateLottery(repository, { agencyId: "agencia-dolores", role: "owner", actorName: "Fede", at, month: "2026-10" });
    await lotterySync(repository);
    remote.diverge(5);
    recordLotteryDay(repository, { date: "2026-10-21", terminalId: "1", amounts: hundredThousandEach });
    await assert.rejects(lotterySync(repository), hasCode("save-conflict"));
    assert.equal(repository.load()?.sales.length, 0);
  });

  it("no abre una fila de otra agencia", async () => {
    const remote = createFakeRemote(null);
    const other = await openLotteryLedger(remote, "agencia-dolores");
    activateLottery(other, { agencyId: "agencia-dolores", role: "owner", actorName: "Fede", at, month: "2026-10" });
    await lotterySync(other);
    await assert.rejects(openLotteryLedger(remote, "otra-agencia"), hasCode("save-failed"));
  });
});
