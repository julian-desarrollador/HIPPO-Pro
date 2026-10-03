import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agencyIdFromName, newAgencyProblem } from "./agency-invite";

describe("nueva agencia", () => {
  it("pide el nombre de la agencia, el del dueño y un correo válido", () => {
    assert.equal(newAgencyProblem("", "Ana", "ana@norte.com"), "Escribí el nombre de la agencia.");
    assert.equal(newAgencyProblem("   ", "Ana", "ana@norte.com"), "Escribí el nombre de la agencia.");
    assert.equal(newAgencyProblem("¡¡!!", "Ana", "ana@norte.com"), "El nombre de la agencia necesita letras o números.");
    assert.equal(newAgencyProblem("A".repeat(81), "Ana", "ana@norte.com"), "El nombre de la agencia es muy largo.");
    assert.equal(newAgencyProblem("Agencia Norte", "", "ana@norte.com"), "Escribí el nombre del dueño.");
    assert.equal(newAgencyProblem("Agencia Norte", "Ana", ""), "Escribí el correo.");
    assert.equal(newAgencyProblem("Agencia Norte", "Ana", "no-es-correo"), "El correo no es válido.");
    assert.equal(newAgencyProblem("  Agencia Norte  ", "  Ana  ", "  ana@norte.com  "), null);
  });

  it("arma el id de la agencia sin tildes ni espacios", () => {
    assert.equal(agencyIdFromName("Agencia Dolores"), "agencia-dolores");
    assert.equal(agencyIdFromName("  Agencia  Núñez  "), "agencia-nunez");
    assert.equal(agencyIdFromName("La Hípica 25 de Mayo"), "la-hipica-25-de-mayo");
    assert.equal(agencyIdFromName("¡¡!!"), "");
    assert.ok(agencyIdFromName("Agencia ".repeat(20)).length <= 50);
    assert.equal(agencyIdFromName("Agencia ".repeat(20)).endsWith("-"), false);
  });
});
