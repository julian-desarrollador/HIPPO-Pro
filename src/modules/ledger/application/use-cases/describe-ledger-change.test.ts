import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createInMemoryLedgerRepository } from "../../adapters/outbound/in-memory-ledger-repository";
import { describeLedgerChange, withAuditEntry, withRestoreAudit } from "./describe-ledger-change";
import { updateCommission } from "./update-commission";
import { updateRacetrack } from "./manage-racetracks";

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
    const noted = withAuditEntry(before, repository.load(), "operator", "2026-09-30T15:00:00.000Z");
    assert.equal(noted.audit?.length, 1);
    assert.equal(noted.audit?.[0]?.actor, "operator");
    assert.match(noted.audit?.[0]?.summary ?? "", /Editó el hipódromo San Isidro/);
    assert.match(noted.audit?.[0]?.summary ?? "", /20 %/);
    assert.match(noted.audit?.[0]?.summary ?? "", /10 %/);

    const restored = withRestoreAudit(repository.load(), "owner", "2026-09-30T16:00:00.000Z");
    assert.equal(restored.audit?.length, 1);
    assert.equal(restored.audit?.[0]?.summary, "Volvió a los datos de agosto.");
    assert.equal(restored.audit?.[0]?.actor, "owner");
  });
});
