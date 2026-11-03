import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agencyIdFromName, agencySignupProblem, newAgencyProblem, personalAgencyNameProblem, removalNameMatches } from "./agency-invite";

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

  it("una agencia de prueba solo pide el nombre", () => {
    assert.equal(personalAgencyNameProblem(""), "Escribí el nombre de la agencia.");
    assert.equal(personalAgencyNameProblem("¡¡!!"), "El nombre de la agencia necesita letras o números.");
    assert.equal(personalAgencyNameProblem("Agencia Norte"), null);
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

describe("quitar una agencia", () => {
  it("pide el nombre escrito igual, sin importar mayúsculas ni espacios de más", () => {
    assert.equal(removalNameMatches("Agencia Norte", "Agencia Norte"), true);
    assert.equal(removalNameMatches("  agencia   NORTE ", "Agencia Norte"), true);
    assert.equal(removalNameMatches("Agencia", "Agencia Norte"), false);
    assert.equal(removalNameMatches("AgenciaNorte", "Agencia Norte"), false);
    assert.equal(removalNameMatches("", ""), false);
    assert.equal(removalNameMatches("   ", "Agencia Norte"), false);
  });
});

describe("alta directa de una agencia", () => {
  it("pide una contraseña de al menos 6 caracteres", () => {
    assert.equal(
      agencySignupProblem("Agencia Norte", "Ana", "ana@norte.com", "12345", "12345"),
      "La contraseña tiene que tener al menos 6 caracteres.",
    );
  });

  it("pide repetir la misma contraseña", () => {
    assert.equal(
      agencySignupProblem("Agencia Norte", "Ana", "ana@norte.com", "123456", "123457"),
      "Las contraseñas no coinciden.",
    );
    assert.equal(agencySignupProblem("Agencia Norte", "Ana", "ana@norte.com", "123456", "123456"), null);
  });

  it("revisa primero la agencia, el dueño y el correo", () => {
    assert.equal(agencySignupProblem("", "Ana", "ana@norte.com", "123456", "123456"), "Escribí el nombre de la agencia.");
  });
});
