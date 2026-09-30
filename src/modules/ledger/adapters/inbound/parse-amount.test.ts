import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  completeAmountInput,
  formatAmountInput,
  formatPercentInput,
  maskAmountInput,
  parseAmountToCents,
  parsePercentToBasisPoints,
  parseSignedPercentToBasisPoints,
} from "./parse-amount";

describe("parseo de importes", () => {
  it("arma el texto del formulario a partir de centavos y vuelve al mismo entero", () => {
    assert.equal(formatAmountInput(123_450), "1.234,50");
    assert.equal(formatAmountInput(0), "0,00");
    assert.equal(formatAmountInput(290_851_100), "2.908.511,00");
    assert.equal(parseAmountToCents(formatAmountInput(123_450)), 123_450);
    assert.equal(parseAmountToCents(formatAmountInput(290_851_100)), 290_851_100);
  });

  it("lee pesos con puntos de miles y coma decimal", () => {
    assert.equal(parseAmountToCents("1234,50"), 123_450);
    assert.equal(parseAmountToCents("1.234,50"), 123_450);
    assert.equal(parseAmountToCents("2.908.511"), 290_851_100);
    assert.equal(parseAmountToCents("7.000.000,00"), 700_000_000);
    assert.equal(parseAmountToCents("$2.908.511,00"), 290_851_100);
    assert.equal(parseAmountToCents("7.50"), 750);
    assert.equal(parseAmountToCents(""), null);
  });

  it("agrupa miles mientras se escribe y completa los centavos al salir", () => {
    assert.equal(maskAmountInput("2908511"), "2.908.511");
    assert.equal(maskAmountInput("2.908.511."), "2.908.511,");
    assert.equal(maskAmountInput("7.50"), "7,50");
    assert.equal(maskAmountInput("2.908.511,5"), "2.908.511,5");
    assert.equal(maskAmountInput(""), "");
    assert.equal(completeAmountInput("2.908.511"), "2.908.511,00");
    assert.equal(completeAmountInput("2.908.511,"), "2.908.511,");
    assert.equal(completeAmountInput(""), "");
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
    assert.equal(parseSignedPercentToBasisPoints("-5"), -500);
    assert.equal(parseSignedPercentToBasisPoints("1"), 100);
    assert.equal(parseSignedPercentToBasisPoints("0"), 0);
    assert.equal(parseSignedPercentToBasisPoints("-100,01"), null);
  });
});
