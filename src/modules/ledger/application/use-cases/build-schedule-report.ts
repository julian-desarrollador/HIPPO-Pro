import { listRacetracks } from "../../domain/racetracks";
import type { LedgerSnapshot } from "../../domain/types";
import { monthTitle } from "../../../../components/calendar-grid";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

function dayHeading(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day}`;
}

export const emptyScheduleReportMessage = "Armá el mes antes de compartirlo.";

export function buildScheduleReport(snapshot: LedgerSnapshot, month: string, agencyName: string): string | null {
  const days = (snapshot.schedule ?? [])
    .filter((day) => day.agencyId === snapshot.agencyId && day.date.startsWith(`${month}-`))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (days.length === 0) {
    return null;
  }
  const tracks = new Map(listRacetracks(snapshot).map((track) => [track.id, track.name]));
  const lines = days.map((day) => {
    if (day.inactive) {
      return `${dayHeading(day.date)} · Sin actividad`;
    }
    const names = day.racetrackIds.map((id) => tracks.get(id) ?? id).join(", ");
    const people = day.people.map((person) => person.name).join(", ");
    return [dayHeading(day.date), names, people].filter(Boolean).join(" · ");
  });
  return [`HippoPro · ${agencyName} · ${monthTitle(month)}`, "", ...lines].join("\n");
}
