import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMonthGrid, localYearMonth, monthTitle, shiftMonth } from "./calendar-grid";

describe("buildMonthGrid", () => {
  it("agosto 2026 empieza en sábado y llena 42 celdas desde el lunes 27 de julio", () => {
    const cells = buildMonthGrid("2026-08");

    assert.equal(cells.length, 42);
    assert.equal(cells[0]?.iso, "2026-07-27");
    assert.equal(cells[0]?.inMonth, false);
    assert.equal(cells[5]?.iso, "2026-08-01");
    assert.equal(cells[5]?.inMonth, true);
    assert.equal(cells[20]?.iso, "2026-08-16");
    assert.equal(cells[35]?.iso, "2026-08-31");
    assert.equal(cells[36]?.iso, "2026-09-01");
    assert.equal(cells[41]?.iso, "2026-09-06");
  });
});

describe("shiftMonth", () => {
  it("pasa de agosto a septiembre y de enero al año anterior", () => {
    assert.equal(shiftMonth("2026-08", 1), "2026-09");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
  });
});

describe("monthTitle", () => {
  it("escribe el mes en español", () => {
    assert.equal(monthTitle("2026-08"), "Agosto 2026");
  });
});

describe("localYearMonth", () => {
  it("coincide con el mes local de esa fecha", () => {
    const iso = "2026-08-15T15:30:00.000Z";
    const date = new Date(iso);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    assert.equal(localYearMonth(iso), expected);
    assert.equal(localYearMonth("no-es-fecha"), null);
  });
});
