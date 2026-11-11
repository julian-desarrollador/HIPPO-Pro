import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { joinNotice, membershipsFrom, personMarks, pickAgency, rememberedAgencyKey, withFullAccess } from "./memberships";

const rows = [
  { user_id: "u1", agency_id: "agencia-dolores", role: "owner", display_name: "Fede", can_invite_owners: true, can_create_agencies: true },
  { user_id: "u1", agency_id: "hipodromo-san-juan", role: "owner", display_name: "Andrés", can_invite_owners: true },
];

describe("una cuenta en varias agencias", () => {
  it("lee una fila por agencia, con el rol y el nombre de cada una", () => {
    const memberships = membershipsFrom(rows);
    assert.equal(memberships.length, 2);
    assert.equal(memberships[1]?.agencyId, "hipodromo-san-juan");
    assert.equal(memberships[1]?.displayName, "Andrés");
    assert.equal(memberships[1]?.canCreateAgencies, false);
  });

  it("descarta filas sin agencia o sin rol, y cuenta una vez la agencia repetida", () => {
    const memberships = membershipsFrom([
      ...rows,
      { agency_id: "agencia-dolores", role: "operator" },
      { agency_id: "", role: "owner" },
      { agency_id: "norte", role: "jefe" },
      null,
    ]);
    assert.deepEqual(
      memberships.map((membership) => [membership.agencyId, membership.role]),
      [
        ["agencia-dolores", "owner"],
        ["hipodromo-san-juan", "owner"],
      ],
    );
    assert.deepEqual(membershipsFrom({ message: "error" }), []);
  });

  it("abre la última agencia usada si la cuenta sigue en ella", () => {
    const memberships = membershipsFrom(rows);
    assert.equal(pickAgency(memberships, "hipodromo-san-juan")?.agencyId, "hipodromo-san-juan");
  });

  it("si la recordada ya no es suya, o no hay ninguna, abre la primera", () => {
    const memberships = membershipsFrom(rows);
    assert.equal(pickAgency(memberships, "lavalle-1442")?.agencyId, "agencia-dolores");
    assert.equal(pickAgency(memberships, null)?.agencyId, "agencia-dolores");
    assert.equal(pickAgency([], "agencia-dolores"), null);
  });

  it("crear agencias vale para la persona si alguna de sus filas lo tiene", () => {
    assert.deepEqual(personMarks(membershipsFrom(rows)), { canCreateAgencies: true, canManageTrash: false, canAccessAll: false });
    assert.deepEqual(personMarks(membershipsFrom([rows[1]])), { canCreateAgencies: false, canManageTrash: false, canAccessAll: false });
  });

  it("un correo con cuenta no frena: avisa que entra con su contraseña de siempre", () => {
    assert.equal(
      joinNotice({ ok: true, outcome: "existing", passwordLinkSent: false }, " Fede@Hotmail.com "),
      "fede@hotmail.com ya tenía cuenta. Entra con su contraseña de siempre y elige esta agencia en Tus agencias.",
    );
  });

  it("si esa cuenta nunca eligió contraseña, avisa que se le reenvió el correo", () => {
    assert.match(joinNotice({ outcome: "existing", passwordLinkSent: true }, "andres@agencia.com") ?? "", /Le reenviamos el correo/);
  });

  it("una cuenta nueva, o una función vieja sin outcome, no suma aviso", () => {
    assert.equal(joinNotice({ ok: true, outcome: "invited" }, "x@x.com"), null);
    assert.equal(joinNotice({ ok: true }, "x@x.com"), null);
    assert.equal(joinNotice(null, "x@x.com"), null);
  });

  it("con acceso total, suma como dueño cada agencia real donde no está", () => {
    const fede = membershipsFrom([{ ...rows[0], can_access_all_agencies: true }]);
    const all = withFullAccess(fede, [
      { agencyId: "agencia-dolores", name: "Agencia Dolores" },
      { agencyId: "lavalle-1442", name: "Lavalle 1442" },
    ]);
    assert.deepEqual(all.map((agency) => agency.agencyId), ["agencia-dolores", "lavalle-1442"]);
    assert.equal(all[1]?.role, "owner");
    assert.equal(all[1]?.canInviteOwners, true);
    assert.equal(all[1]?.displayName, "Fede");
  });

  it("sin acceso total, la lista queda igual", () => {
    const memberships = membershipsFrom(rows);
    assert.equal(withFullAccess(memberships, [{ agencyId: "lavalle-1442" }]).length, 2);
  });

  it("cada cuenta recuerda su agencia por separado en el navegador", () => {
    assert.notEqual(rememberedAgencyKey("u1"), rememberedAgencyKey("u2"));
  });
});
