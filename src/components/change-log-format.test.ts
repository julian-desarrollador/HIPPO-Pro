import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { changeKind, dayLabel, groupByDay, timeLabel, whenLabel, whoLabel } from "./change-log-format";

// 10/11/2026 20:24 in Buenos Aires is 23:24 UTC.
const NOW = new Date("2026-11-10T23:30:00Z");

describe("historial en el celular", () => {
  it("distingue cargar, quitar y editar por el verbo", () => {
    assert.equal(changeKind("Cargó un depósito de $ 3.200.000,00 en Palermo."), "added");
    assert.equal(changeKind("Agregó la categoría Seguro."), "added");
    assert.equal(changeKind("Quitó el depósito de Palermo del 10/11/2026."), "removed");
    assert.equal(changeKind("Editó el día 08/11/2026 de La Plata."), "edited");
    assert.equal(changeKind("Volvió a los datos de agosto."), "edited");
  });

  it("la hora va en 24 h y en hora de Argentina", () => {
    assert.equal(timeLabel("2026-11-10T23:24:00Z"), "20:24");
    assert.equal(timeLabel("no es una fecha"), "");
    assert.equal(whenLabel("2026-11-10T23:24:00Z"), "10/11/2026 20:24");
  });

  it("los días dicen Hoy y Ayer, y el resto el día de la semana", () => {
    assert.equal(dayLabel("2026-11-10T23:24:00Z", NOW), "Hoy · martes 10/11");
    assert.equal(dayLabel("2026-11-09T15:00:00Z", NOW), "Ayer · lunes 09/11");
    assert.equal(dayLabel("2026-11-08T15:00:00Z", NOW), "domingo 08/11");
  });

  it("de noche en Argentina sigue siendo el mismo día, aunque en Londres ya sea el siguiente", () => {
    // 01:30 UTC of the 11th is 22:30 of the 10th in Buenos Aires.
    assert.equal(dayLabel("2026-11-11T01:30:00Z", NOW), "Hoy · martes 10/11");
  });

  it("agrupa por día sin cambiar el orden", () => {
    const groups = groupByDay(
      [
        { id: "c", at: "2026-11-10T23:24:00Z" },
        { id: "b", at: "2026-11-10T23:20:00Z" },
        { id: "a", at: "2026-11-08T15:00:00Z" },
      ],
      NOW,
    );
    assert.deepEqual(
      groups.map((group) => [group.label, group.entries.map((entry) => entry.id)]),
      [
        ["Hoy · martes 10/11", ["c", "b"]],
        ["domingo 08/11", ["a"]],
      ],
    );
  });

  it("quién lo hizo: el nombre, o el rol en los cambios viejos", () => {
    assert.equal(whoLabel("operator", " Matias Gimenez Corti "), "Matias Gimenez Corti");
    assert.equal(whoLabel("owner"), "Dueño");
    assert.equal(whoLabel("operator", ""), "Operador");
  });
});
