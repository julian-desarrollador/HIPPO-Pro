import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { supportQuestionProblem, whatsappGreeting, whatsappLink, whatsappNumber } from "./support-question";

describe("pregunta para HippoPro", () => {
  it("pide teléfono con código de área y una pregunta", () => {
    assert.equal(supportQuestionProblem("Ana", "", "¿Cuánto cuesta?"), "Escribí tu teléfono.");
    assert.equal(supportQuestionProblem("Ana", "1234", "¿Cuánto cuesta?"), "Revisá el teléfono: escribilo con el código de área.");
    assert.equal(supportQuestionProblem("Ana", "11 5555-5555", "   "), "Escribí tu pregunta.");
    assert.equal(supportQuestionProblem("Ana", "11 5555-5555", "x".repeat(1001)), "La pregunta es muy larga.");
    assert.equal(supportQuestionProblem("A".repeat(81), "11 5555-5555", "¿Cuánto cuesta?"), "El nombre es muy largo.");
  });

  it("el nombre es opcional", () => {
    assert.equal(supportQuestionProblem("", "11 5555-5555", "¿Cuánto cuesta?"), null);
  });
});

describe("número de WhatsApp", () => {
  it("un celular argentino escrito de cualquier forma queda 549 + área + número", () => {
    assert.equal(whatsappNumber("11 5555-5555"), "5491155555555");
    assert.equal(whatsappNumber("011 15 5555-5555"), "5491155555555");
    assert.equal(whatsappNumber("+54 9 11 5555-5555"), "5491155555555");
    assert.equal(whatsappNumber("+54 11 5555 5555"), "5491155555555");
    assert.equal(whatsappNumber("0221 15 555-5555"), "5492215555555");
    assert.equal(whatsappNumber("2245 15 55-5555"), "5492245555555");
  });

  it("un número de otro país queda como está", () => {
    assert.equal(whatsappNumber("+598 99 123 456"), "59899123456");
  });

  it("sin forma de saber el número no arma el enlace", () => {
    assert.equal(whatsappNumber("5555"), null);
    assert.equal(whatsappLink("5555", "Hola"), null);
  });

  it("el enlace lleva el saludo", () => {
    assert.equal(
      whatsappLink("11 5555-5555", whatsappGreeting("Ana")),
      "https://wa.me/5491155555555?text=Hola%20Ana%2C%20te%20escribimos%20de%20HippoPro%20por%20la%20pregunta%20que%20dejaste.",
    );
  });
});
