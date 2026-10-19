import { LedgerError } from "../../domain/errors";
import type { StaffMember } from "../../domain/types";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type AddStaffInput = { name: string };

function comparableName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function normalizedName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new LedgerError("invalid-name");
  }
  return name;
}

export function addStaffMember(repository: LedgerRepository, input: AddStaffInput): StaffMember {
  const snapshot = repository.load();
  const name = normalizedName(input.name);
  const duplicate = (snapshot.staff ?? []).some(
    (person) => person.agencyId === snapshot.agencyId && comparableName(person.name) === comparableName(name),
  );
  if (duplicate) {
    throw new LedgerError("duplicate-staff");
  }
  const person: StaffMember = { id: createId("staff"), agencyId: snapshot.agencyId, name };
  repository.save({ ...snapshot, staff: [...(snapshot.staff ?? []), person] });
  return person;
}

export function removeStaffMember(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const current = snapshot.staff ?? [];
  if (!current.some((person) => person.id === id && person.agencyId === snapshot.agencyId)) {
    throw new LedgerError("unknown-staff");
  }
  const used = (snapshot.schedule ?? []).some(
    (day) => day.agencyId === snapshot.agencyId && day.people.some((person) => person.id === id),
  );
  if (used) {
    throw new LedgerError("staff-in-use");
  }
  repository.save({ ...snapshot, staff: current.filter((person) => person.id !== id) });
}
