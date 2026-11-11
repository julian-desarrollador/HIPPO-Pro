import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { newPasswordProblem } from "./password-rule";

describe("contraseña nueva", () => {
  it("pide al menos 10 caracteres", () => {
    assert.equal(newPasswordProblem("clave1234", "clave1234"), "La contraseña tiene que tener al menos 10 caracteres.");
  });

  it("pide letras y números", () => {
    assert.equal(newPasswordProblem("1234567890", "1234567890"), "La contraseña tiene que tener letras y números.");
    assert.equal(newPasswordProblem("solamenteletras", "solamenteletras"), "La contraseña tiene que tener letras y números.");
  });

  it("acepta letras con tilde y la ñ", () => {
    assert.equal(newPasswordProblem("añoNuevo2026", "añoNuevo2026"), null);
  });

  it("pide repetir la misma", () => {
    assert.equal(newPasswordProblem("caballo2026", "caballo2027"), "Las contraseñas no coinciden.");
  });

  it("al cambiarla, tiene que ser distinta de la actual", () => {
    assert.equal(
      newPasswordProblem("caballo2026", "caballo2026", "caballo2026"),
      "La contraseña nueva tiene que ser distinta de la actual.",
    );
    assert.equal(newPasswordProblem("caballo2027", "caballo2027", "caballo2026"), null);
  });
});
