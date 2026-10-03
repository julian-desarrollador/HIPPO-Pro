import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import { listExpenseCategories } from "../../domain/expense-categories";
import { listRacetracks } from "../../domain/racetracks";
import type { LedgerSnapshot } from "../../domain/types";
import { addRacetrack } from "../../application/use-cases/manage-racetracks";
import { recordDay } from "../../application/use-cases/record-day";
import { summarizeMonth } from "../../application/use-cases/summarize-month";
import { createAugust2026Snapshot, PREVIEW_AGENCY_ID } from "./august-2026-seed";
import { ledgerSync, openAgencyLedger, type LedgerRemote, type LedgerRemoteRow } from "./agency-ledger";
import { readSupabaseConfig } from "./supabase-config";

function createFakeRemote(initial: LedgerRemoteRow | null, options?: { failUpdate?: boolean }) {
  let row = initial ? structuredClone(initial) : null;
  return {
    stored: () => (row ? structuredClone(row) : null),
    diverge(version: number) {
      if (row) {
        row = { snapshot: row.snapshot, version };
      }
    },
    async read(): Promise<LedgerRemoteRow | null> {
      return row ? structuredClone(row) : null;
    },
    async insert(_agencyId: string, snapshot: LedgerSnapshot) {
      if (row) {
        return "exists" as const;
      }
      row = { snapshot: structuredClone(snapshot), version: 1 };
      return "created" as const;
    },
    async update(_agencyId: string, snapshot: LedgerSnapshot, expectedVersion: number) {
      if (options?.failUpdate) {
        throw new Error("offline");
      }
      if (!row || row.version !== expectedVersion) {
        return "conflict" as const;
      }
      row = { snapshot: structuredClone(snapshot), version: expectedVersion + 1 };
      return expectedVersion + 1;
    },
  };
}

describe("libro de la agencia", () => {
  it("si no hay fila, guarda la semilla de agosto", async () => {
    const remote = createFakeRemote(null);
    const repository = await openAgencyLedger(remote, PREVIEW_AGENCY_ID);
    assert.equal(repository.load().days.length, createAugust2026Snapshot().days.length);
    assert.equal(remote.stored()?.version, 1);
  });

  it("si ya hay un libro, no lo pisa con la semilla", async () => {
    const existing = createAugust2026Snapshot();
    existing.days = existing.days.slice(0, 2);
    const remote = createFakeRemote({ snapshot: existing, version: 4 });
    const repository = await openAgencyLedger(remote, PREVIEW_AGENCY_ID);
    assert.equal(repository.load().days.length, 2);
    assert.equal(remote.stored()?.version, 4);
  });

  it("guardar sube la versión y el otro lector ve el día", async () => {
    const remote = createFakeRemote(null);
    const repository = await openAgencyLedger(remote, PREVIEW_AGENCY_ID);
    recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    await ledgerSync(repository);
    assert.equal(remote.stored()?.version, 2);
    assert.equal(repository.load().days.length, createAugust2026Snapshot().days.length + 1);
  });

  it("si la red falla, el libro queda como estaba", async () => {
    const remote = createFakeRemote(null, { failUpdate: true });
    const repository = await openAgencyLedger(remote, PREVIEW_AGENCY_ID);
    const before = repository.load().days.length;
    recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    await assert.rejects(ledgerSync(repository), (error: unknown) => error instanceof LedgerError && error.code === "save-failed");
    assert.equal(repository.load().days.length, before);
    assert.equal(remote.stored()?.version, 1);
  });

  it("si alguien guardó antes, se vuelve a cargar el libro de la agencia", async () => {
    const remote = createFakeRemote(null);
    const repository = await openAgencyLedger(remote, PREVIEW_AGENCY_ID);
    remote.diverge(9);
    recordDay(repository, {
      date: "2026-08-16",
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    await assert.rejects(ledgerSync(repository), (error: unknown) => error instanceof LedgerError && error.code === "save-conflict");
    assert.equal(repository.load().days.length, createAugust2026Snapshot().days.length);
  });
});

describe("libro de una agencia nueva", () => {
  it("una agencia que no es Dolores arranca sin días, depósitos, gastos ni saldos", async () => {
    const remote = createFakeRemote(null);
    const repository = await openAgencyLedger(remote, "agencia-norte");
    const snapshot = repository.load();
    assert.equal(snapshot.agencyId, "agencia-norte");
    assert.equal(snapshot.days.length, 0);
    assert.equal(snapshot.deposits.length, 0);
    assert.equal(snapshot.expenses.length, 0);
    assert.equal(snapshot.openingBalances.length, 0);
    assert.equal(summarizeMonth(snapshot, "2026-08").owedCents, 0);
    assert.equal(remote.stored()?.version, 1);
  });

  it("no ve San Isidro, Palermo ni La Plata, ni los retiros de Fede y Mati", async () => {
    const repository = await openAgencyLedger(createFakeRemote(null), "agencia-norte");
    const snapshot = repository.load();
    assert.equal(listRacetracks(snapshot).length, 0);
    const categories = listExpenseCategories(snapshot);
    assert.equal(categories.some((category) => category.kind === "partner-withdrawal"), false);
    assert.ok(categories.some((category) => category.id === "sueldo"));
  });

  it("agrega San Isidro con su propio porcentaje y sin el ajuste de Dolores", async () => {
    const repository = await openAgencyLedger(createFakeRemote(null), "agencia-norte");
    addRacetrack(repository, { name: "San Isidro", commissionBasisPoints: 1200, depositAdjustmentBasisPoints: 0 });
    const month = repository.load().month;
    recordDay(repository, {
      date: `${month}-05`,
      racetrackId: "san-isidro",
      soldCents: 1_000_000,
      cancelledCents: 0,
      paidCents: 0,
    });
    const track = summarizeMonth(repository.load(), month).racetracks.find((item) => item.racetrackId === "san-isidro");
    assert.equal(track?.commissionCents, 120_000);
    assert.equal(track?.amountToDepositCents, 1_000_000);
    assert.equal(listRacetracks(repository.load()).length, 1);
  });

  it("volver a empezar deja el libro vacío", async () => {
    const remote = createFakeRemote(null);
    const repository = await openAgencyLedger(remote, "agencia-norte");
    addRacetrack(repository, { name: "La Punta", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 });
    repository.reset();
    await ledgerSync(repository);
    assert.equal(listRacetracks(remote.stored()?.snapshot as LedgerSnapshot).length, 0);
  });
});

describe("configuración de Supabase", () => {
  it("sin las dos claves sigue en este navegador", () => {
    assert.equal(readSupabaseConfig("", ""), null);
    assert.equal(readSupabaseConfig(undefined, undefined), null);
  });

  it("con una sola clave no adivina la otra", () => {
    assert.equal(readSupabaseConfig("https://ejemplo.supabase.co", ""), "incomplete");
    assert.equal(readSupabaseConfig("", "anon"), "incomplete");
  });

  it("con las dos claves arma la conexión", () => {
    assert.deepEqual(readSupabaseConfig(" https://ejemplo.supabase.co ", " anon ", ""), {
      url: "https://ejemplo.supabase.co",
      anonKey: "anon",
      publicAccess: false,
    });
  });

  it("con la marca pública abre el libro sin login", () => {
    const opened = readSupabaseConfig("https://ejemplo.supabase.co", "anon", "1");
    const spelledOut = readSupabaseConfig("https://ejemplo.supabase.co", "anon", "true");
    const closed = readSupabaseConfig("https://ejemplo.supabase.co", "anon", "0");
    assert.ok(opened && opened !== "incomplete" && opened.publicAccess);
    assert.ok(spelledOut && spelledOut !== "incomplete" && spelledOut.publicAccess);
    assert.ok(closed && closed !== "incomplete" && !closed.publicAccess);
  });
});
