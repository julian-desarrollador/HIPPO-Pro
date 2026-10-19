import { LedgerError } from "../../domain/errors";
import { listRacetracks } from "../../domain/racetracks";
import type { ScheduleDay, SchedulePerson } from "../../domain/types";
import { assertIsoDate } from "../../domain/validation";
import { createId } from "../create-id";
import type { LedgerRepository } from "../ports/ledger-repository";

export type SaveScheduleDayInput = {
  date: string;
  racetrackIds: string[];
  people: SchedulePerson[];
  inactive: boolean;
};

export function saveScheduleDay(repository: LedgerRepository, input: SaveScheduleDayInput): ScheduleDay {
  assertIsoDate(input.date);
  const snapshot = repository.load();
  const tracks = new Set(listRacetracks(snapshot).map((track) => track.id));
  const racetrackIds = [...new Set(input.racetrackIds)];
  if (!input.inactive && racetrackIds.some((id) => !tracks.has(id))) {
    throw new LedgerError("unknown-racetrack");
  }
  const people = input.inactive
    ? []
    : input.people.filter((person, index, all) => person.name.trim() && all.findIndex((item) => item.id === person.id) === index);
  const existing = (snapshot.schedule ?? []).find((day) => day.agencyId === snapshot.agencyId && day.date === input.date);
  const day: ScheduleDay = {
    id: existing?.id ?? createId("schedule"),
    agencyId: snapshot.agencyId,
    date: input.date,
    racetrackIds: input.inactive ? [] : racetrackIds,
    people: people.map((person) => ({ id: person.id, name: person.name.trim() })),
    inactive: input.inactive,
  };
  const others = (snapshot.schedule ?? []).filter((item) => item.id !== day.id);
  repository.save({ ...snapshot, schedule: [...others, day] });
  return day;
}

export function removeScheduleDay(repository: LedgerRepository, id: string): void {
  const snapshot = repository.load();
  const current = snapshot.schedule ?? [];
  if (!current.some((day) => day.id === id && day.agencyId === snapshot.agencyId)) {
    throw new LedgerError("unknown-entry");
  }
  repository.save({ ...snapshot, schedule: current.filter((day) => day.id !== id) });
}
