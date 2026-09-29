import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAmountInput, formatPercentInput, parseAmountToCents, parsePercentToBasisPoints } from "./parse-amount";

describe("parseo de importes", () => {
  it("arma el texto del formulario a partir de centavos y vuelve al mismo entero", () => {
    assert.equal(formatAmountInput(123_450), "1234,50");
    assert.equal(formatAmountInput(0), "0,00");
    assert.equal(parseAmountToCents(formatAmountInput(123_450)), 123_450);
  });

  it("lee un porcentaje con hasta dos decimales y lo guarda en puntos básicos", () => {
    assert.equal(parsePercentToBasisPoints("15"), 1500);
    assert.equal(parsePercentToBasisPoints("15,25"), 1525);
    assert.equal(parsePercentToBasisPoints("0"), 0);
    assert.equal(parsePercentToBasisPoints("100"), 10_000);
    assert.equal(parsePercentToBasisPoints("100,01"), null);
    assert.equal(parsePercentToBasisPoints(""), null);
    assert.equal(formatPercentInput(1500), "15");
    assert.equal(formatPercentInput(1525), "15,25");
  });
});
