import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LedgerError } from "../../domain/errors";
import type { LedgerSnapshot } from "../../domain/types";
import { recordDay } from "../../application/use-cases/record-day";
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
