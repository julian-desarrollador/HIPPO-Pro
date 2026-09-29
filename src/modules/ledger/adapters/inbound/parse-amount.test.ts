import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAmountInput, parseAmountToCents } from "./parse-amount";

describe("parseo de importes", () => {
  it("arma el texto del formulario a partir de centavos y vuelve al mismo entero", () => {
    assert.equal(formatAmountInput(123_450), "1234,50");
    assert.equal(formatAmountInput(0), "0,00");
    assert.equal(parseAmountToCents(formatAmountInput(123_450)), 123_450);
  });
});
