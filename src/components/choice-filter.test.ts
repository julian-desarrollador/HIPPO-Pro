import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { choiceQueryMatchesAny, filterChoiceOptions } from "./choice-filter";

const options = [
  { id: "sueldo", label: "Sueldo" },
  { id: "luz", label: "Luz" },
  { id: "adelanto-fede", label: "Adelanto Fede" },
];

describe("filterChoiceOptions", () => {
  it("filtra al escribir y no distingue tildes ni mayúsculas", () => {
    const found = filterChoiceOptions(options, "LUZ", "sueldo");
    assert.deepEqual(
      found.map((option) => option.id),
      ["sueldo", "luz"],
    );
    assert.equal(choiceQueryMatchesAny(options, "fede"), true);
    assert.equal(choiceQueryMatchesAny(options, "xyz"), false);
  });

  it("sin texto deja la lista completa", () => {
    assert.equal(filterChoiceOptions(options, "  ", "sueldo").length, 3);
  });
});
