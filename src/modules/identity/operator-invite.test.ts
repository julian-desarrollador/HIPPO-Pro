import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inviteOperatorProblem } from "./operator-invite";

describe("invitación de operador", () => {
  it("pide el nombre y un correo válido", () => {
    assert.equal(inviteOperatorProblem("", ""), "Escribí el nombre.");
    assert.equal(inviteOperatorProblem("   ", "ana@agencia.com"), "Escribí el nombre.");
    assert.equal(inviteOperatorProblem("Ana", ""), "Escribí el correo.");
    assert.equal(inviteOperatorProblem("Ana", "   "), "Escribí el correo.");
    assert.equal(inviteOperatorProblem("Ana", "no-es-correo"), "El correo no es válido.");
    assert.equal(inviteOperatorProblem("Ana", "ana@agencia.com"), null);
    assert.equal(inviteOperatorProblem("  Ana  ", "  ana@agencia.com  "), null);
  });
});
