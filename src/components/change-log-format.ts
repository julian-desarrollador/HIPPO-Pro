/** One change in a Historial, as the audit stores it. */
export type ChangeEntry = {
  id: string;
  at: string;
  actor: string;
  actorName?: string;
  summary: string;
};

export type ChangeKind = "added" | "removed" | "edited";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

/** By the verb it starts with: Cargó and Agregó add, Quitó removes, anything else edits. */
export function changeKind(summary: string): ChangeKind {
  const verb = summary.trim().split(/\s+/)[0]?.toLocaleLowerCase("es") ?? "";
  if (verb === "cargó" || verb === "agregó") {
    return "added";
  }
  if (verb === "quitó") {
    return "removed";
  }
  return "edited";
}

/** The name of whoever did it. Older changes, without a name, say the role. */
export function whoLabel(actor: string, actorName?: string): string {
  const name = actorName?.trim();
  if (name) {
    return name;
  }
  return actor === "owner" ? "Dueño" : "Operador";
}

function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, ...options })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

/** The day in Argentina, as 2026-11-10. Empty for a date that cannot be read. */
function dayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${day.year}-${day.month}-${day.day}`;
}

/** The hour in Argentina, in 24 h: 20:24. */
export function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const time = parts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${time.hour}:${time.minute}`;
}

/** The full date and hour, for the table on a computer: 10/11/2026 20:24. */
export function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const day = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${day.day}/${day.month}/${day.year} ${timeLabel(iso)}`;
}

/** The heading of a day: «Hoy · martes 10/11», «Ayer · lunes 09/11» or «sábado 08/11». */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const key = dayKey(date);
  if (!key) {
    return "Sin fecha";
  }
  const day = parts(date, { weekday: "long", day: "2-digit", month: "2-digit" });
  const plain = `${day.weekday} ${day.day}/${day.month}`;
  if (key === dayKey(now)) {
    return `Hoy · ${plain}`;
  }
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) {
    return `Ayer · ${plain}`;
  }
  return plain;
}

/** The changes grouped by day, keeping their order: give them newest first. */
export function groupByDay<T extends { at: string }>(
  entries: readonly T[],
  now: Date = new Date(),
): { key: string; label: string; entries: T[] }[] {
  const groups: { key: string; label: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(new Date(entry.at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: dayLabel(entry.at, now), entries: [entry] });
    }
  }
  return groups;
}
