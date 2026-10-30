import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAugust2026Snapshot } from "../../adapters/outbound/august-2026-seed";
import { listSettledDays, summarizeMonth } from "./summarize-month";
import { totalAmounts, totalSettledDays } from "./table-totals";

describe("totales al pie de las tablas", () => {
  it("suma los días de Carga igual que el resumen de Inicio", () => {
    const snapshot = createAugust2026Snapshot();
    const total = totalSettledDays(listSettledDays(snapshot));
    const summary = summarizeMonth(snapshot);

    assert.equal(total.netCents, summary.netCents);
    assert.equal(total.commissionCents, summary.billingCents);
    assert.equal(
      total.amountToDepositCents,
      summary.racetracks.reduce((sum, track) => sum + track.amountToDepositCents, 0),
    );
  });

  it("devuelve cero cuando no hay filas", () => {
    assert.deepEqual(totalSettledDays([]), {
      soldCents: 0,
      cancelledCents: 0,
      netCents: 0,
      paidCents: 0,
      commissionCents: 0,
      amountToDepositCents: 0,
    });
    assert.equal(totalAmounts([]), 0);
  });

  it("suma los gastos del mes igual que el resumen", () => {
    const snapshot = createAugust2026Snapshot();
    const summary = summarizeMonth(snapshot);
    const month = snapshot.expenses.filter((expense) => expense.month === snapshot.month);

    assert.equal(
      totalAmounts(month.filter((expense) => expense.kind === "agency")),
      summary.agencyExpenseCents,
    );
    assert.equal(
      totalAmounts(month.filter((expense) => expense.kind === "partner-withdrawal")),
      summary.partnerWithdrawalCents,
    );
  });
});
