import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { createEmptyAgencySnapshot } from "../../adapters/outbound/starting-snapshot";
import { visibleAuditEntries } from "../../domain/access";
import { describeLedgerChange, withAuditEntry, withRestoreAudit } from "./describe-ledger-change";
import { updateCommission } from "./update-commission";
import { addRacetrack, updateRacetrack } from "./manage-racetracks";

describe("historial", () => {
  it("describe el cambio de comisión y no anota si el libro sigue igual", () => {
    const repository = createInMemoryLedgerRepository();
    const before = repository.load();
    updateCommission(repository, { racetrackId: "palermo", commissionBasisPoints: 1200 });
    const summary = describeLedgerChange(before, repository.load());
    assert.equal(summary, "Cambió la comisión de Palermo de 9 % a 12 %.");
    assert.equal(describeLedgerChange(repository.load(), repository.load()), null);
  });

  it("anota quién editó un hipódromo fijo y la vuelta a agosto deja una sola fila", () => {
    const repository = createInMemoryLedgerRepository();
    const before = repository.load();
    updateRacetrack(repository, {
      id: "san-isidro",
      name: "San Isidro",
      commissionBasisPoints: 2000,
      depositAdjustmentBasisPoints: -1000,
    });
    const noted = withAuditEntry(before, repository.load(), "operator", "2026-09-30T15:00:00.000Z", "Mati");
    assert.equal(noted.audit?.length, 1);
    assert.equal(noted.audit?.[0]?.actor, "operator");
    assert.equal(noted.audit?.[0]?.actorName, "Mati");
    assert.match(noted.audit?.[0]?.summary ?? "", /Editó el hipódromo San Isidro/);
    assert.match(noted.audit?.[0]?.summary ?? "", /20 %/);
    assert.match(noted.audit?.[0]?.summary ?? "", /10 %/);

    const unnamed = withAuditEntry(before, repository.load(), "operator", "2026-09-30T15:00:00.000Z", "  ");
    assert.equal(unnamed.audit?.[0]?.actorName, undefined);

    const restored = withRestoreAudit(repository.load(), "owner", "2026-09-30T16:00:00.000Z", "Fede");
    assert.equal(restored.audit?.length, 1);
    assert.equal(restored.audit?.[0]?.summary, "Volvió a los datos de agosto.");
    assert.equal(restored.audit?.[0]?.actor, "owner");
    assert.equal(restored.audit?.[0]?.actorName, "Fede");
  });

  it("agregar un hipódromo anota una sola línea, también el primero de una agencia nueva", () => {
    const dolores = createInMemoryLedgerRepository();
    const doloresBefore = dolores.load();
    addRacetrack(dolores, { name: "La Punta", commissionBasisPoints: 1000, depositAdjustmentBasisPoints: 0 });
    assert.equal(describeLedgerChange(doloresBefore, dolores.load()), "Agregó el hipódromo La Punta.");

    const newAgency = createInMemoryLedgerRepository(createEmptyAgencySnapshot("agencia-prueba"));
    const newAgencyBefore = newAgency.load();
    addRacetrack(newAgency, { name: "San Isidro", commissionBasisPoints: 1200, depositAdjustmentBasisPoints: 0 });
    assert.equal(describeLedgerChange(newAgencyBefore, newAgency.load()), "Agregó el hipódromo San Isidro.");
  });
});

describe("historial de lo que solo ve el dueño", () => {
  const agency = { id: "e1", agencyId: "dolores", month: "2026-09", paidOn: "2026-09-04", categoryId: "luz", detail: "", amountCents: 10_000, kind: "agency" as const };
  const partner = { ...agency, id: "e2", categoryId: "adelanto-fede", kind: "partner-withdrawal" as const };
  const base = createEmptyAgencySnapshot("dolores");

  it("un adelanto queda marcado y el operador no lo ve", () => {
    const after = withAuditEntry(base, { ...base, expenses: [partner] }, "owner", "2026-09-04T10:00:00.000Z");
    const rows = after.audit ?? [];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.ownerOnly, true);
    assert.equal(visibleAuditEntries(rows, "owner").length, 1);
    assert.equal(visibleAuditEntries(rows, "operator").length, 0);
  });

  it("un gasto común lo ven los dos", () => {
    const after = withAuditEntry(base, { ...base, expenses: [agency] }, "operator", "2026-09-04T10:00:00.000Z");
    const rows = after.audit ?? [];
    assert.equal(rows[0]?.ownerOnly, undefined);
    assert.equal(visibleAuditEntries(rows, "operator").length, 1);
  });

  it("si un guardado toca los dos, el operador ve solo lo suyo", () => {
    const after = withAuditEntry(base, { ...base, expenses: [agency, partner] }, "owner", "2026-09-04T10:00:00.000Z");
    const seen = visibleAuditEntries(after.audit ?? [], "operator");
    assert.equal(seen.length, 1);
    assert.match(seen[0]?.summary ?? "", /Luz/);
    assert.doesNotMatch(seen[0]?.summary ?? "", /Adelanto/);
  });
});
