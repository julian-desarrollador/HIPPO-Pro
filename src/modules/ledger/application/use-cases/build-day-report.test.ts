import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCents } from "../../domain/money";
import type { SettledDay } from "./summarize-month";
import { buildDayReport, emptyDayReportMessage } from "./build-day-report";

const sanIsidro: SettledDay = {
  id: "day-1",
  agencyId: "agencia-dolores",
  date: "2026-08-16",
  racetrackId: "san-isidro",
  soldCents: 10_000,
  cancelledCents: 0,
  paidCents: 0,
  racetrackName: "San Isidro",
  netCents: 10_000,
  commissionCents: 1_500,
  amountToDepositCents: 9_500,
};

describe("texto de la venta del día", () => {
  it("arma el día de San Isidro y avisa si no hay nada cargado", () => {
    assert.equal(buildDayReport([], "2026-08-16", "Agencia Dolores"), null);
    assert.equal(emptyDayReportMessage, "Cargá el día antes de compartirlo.");

    const report = buildDayReport([sanIsidro], "2026-08-16", "Agencia Dolores");
    assert.ok(report);
    assert.match(report, /HippoPro · Agencia Dolores · 16\/08\/2026/);
    assert.match(report, /San Isidro/);
    assert.match(report, /Comisión \(15 %\)/);
    assert.equal(report.includes("Ajuste"), false);
    assert.match(report, new RegExp(formatCents(10_000).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(report.includes("Facturación"), false);
    assert.equal(report.includes("Saldo del mes"), false);
  });

  it("lleva el nombre de la agencia que lo comparte", () => {
    const report = buildDayReport([{ ...sanIsidro, agencyId: "agencia-norte" }], "2026-08-16", "Agencia Norte");
    assert.ok(report);
    assert.match(report, /HippoPro · Agencia Norte · 16\/08\/2026/);
    assert.equal(report.includes("Dolores"), false);
  });
});
