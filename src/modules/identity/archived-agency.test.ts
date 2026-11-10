import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { archivedAgenciesFrom, archivedAgencyDetail, archivedDay } from "./archived-agency";

describe("agencias quitadas", () => {
  it("lee la lista y separa las pruebas de las agencias reales", () => {
    const rows = archivedAgenciesFrom({
      agencies: [
        {
          agencyId: "prueba-hipica-y-quiniela-799227",
          name: " Prueba hipica y quiniela ",
          kind: "personal",
          productMode: "both",
          archivedAt: "2026-11-06T15:00:00+00:00",
          archivedBy: "Fede",
          testOf: "Fede",
        },
        { agencyId: "lavalle-1442", name: "Lavalle 1442", kind: "agency", productMode: "lottery", archivedAt: "2026-11-07T02:30:00Z" },
      ],
    });
    assert.equal(rows?.length, 2);
    assert.equal(rows?.[0]?.name, "Prueba hipica y quiniela");
    assert.equal(rows?.[0]?.kind, "personal");
    assert.equal(rows?.[1]?.kind, "agency");
    assert.equal(rows?.[1]?.archivedBy, "");
  });

  it("descarta filas sin id, sin nombre o sin fecha, y una respuesta sin lista", () => {
    const rows = archivedAgenciesFrom({
      agencies: [
        { agencyId: "", name: "Sin id", archivedAt: "2026-11-06T15:00:00Z" },
        { agencyId: "sin-nombre", name: " ", archivedAt: "2026-11-06T15:00:00Z" },
        { agencyId: "sin-fecha", name: "Sin fecha", archivedAt: "ayer" },
        null,
      ],
    });
    assert.deepEqual(rows, []);
    assert.equal(archivedAgenciesFrom({ message: "No se pudo cargar la lista." }), null);
  });

  it("la fecha es la de Argentina, no la de Londres", () => {
    // 02:30 in London is still the 6th in Buenos Aires.
    assert.equal(archivedDay("2026-11-07T02:30:00Z"), "06/11/2026");
  });

  it("dice qué es, cuándo se quitó y quién", () => {
    const [test, real] = archivedAgenciesFrom({
      agencies: [
        { agencyId: "p-1", name: "Prueba", kind: "personal", productMode: "racing", archivedAt: "2026-11-06T15:00:00Z", archivedBy: "Fede", testOf: "Fede" },
        { agencyId: "norte", name: "Norte", kind: "agency", productMode: "both", archivedAt: "2026-11-06T15:00:00Z" },
      ],
    }) ?? [];
    assert.equal(archivedAgencyDetail(test!), "Prueba de Fede. Quitada el 06/11/2026 por Fede.");
    assert.equal(archivedAgencyDetail(real!), "Hípica y lotería. Quitada el 06/11/2026.");
  });
});
