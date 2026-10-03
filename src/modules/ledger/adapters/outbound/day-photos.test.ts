import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dayPhotoProblem } from "./day-photos";

describe("imagen del día", () => {
  it("acepta jpeg, png y webp dentro de los 5 MB", () => {
    assert.equal(dayPhotoProblem({ size: 1000, contentType: "image/jpeg", name: "ticket.jpg" }), null);
    assert.equal(dayPhotoProblem({ size: 1000, contentType: "image/png", name: "ticket.png" }), null);
    assert.equal(dayPhotoProblem({ size: 1000, contentType: "", name: "ticket.webp" }), null);
  });

  it("rechaza otro tipo, un archivo vacío y uno de más de 5 MB", () => {
    assert.equal(
      dayPhotoProblem({ size: 1000, contentType: "application/pdf", name: "ticket.pdf" }),
      "La imagen tiene que ser jpeg, png o webp.",
    );
    assert.equal(
      dayPhotoProblem({ size: 0, contentType: "image/jpeg", name: "ticket.jpg" }),
      "La imagen está vacía.",
    );
    assert.equal(
      dayPhotoProblem({ size: 5 * 1024 * 1024 + 1, contentType: "image/jpeg", name: "ticket.jpg" }),
      "La imagen no puede pasar de 5 MB.",
    );
  });
});
