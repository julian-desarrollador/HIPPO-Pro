import { agencyModeFrom, type AgencyMode } from "../ledger/domain/features";

/** A removed agency, as the trash lists it. Its data is still in the base. */
export type ArchivedAgency = {
  agencyId: string;
  name: string;
  /** personal: a test made with «Crear y entrar». agency: a real one, with its people. */
  kind: "personal" | "agency";
  productMode: AgencyMode;
  /** When it was removed, as the base stores it. */
  archivedAt: string;
  /** Who removed it. Empty when the base does not say. */
  archivedBy: string;
  /** Whose test it is. Empty for a real agency. */
  testOf: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads the answer of create-agency (action list-archived). Bad rows are skipped. */
export function archivedAgenciesFrom(data: unknown): ArchivedAgency[] | null {
  const rows: unknown = data && typeof data === "object" && "agencies" in data ? data.agencies : null;
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const row = value as Record<string, unknown>;
    const agencyId = text(row.agencyId);
    const name = text(row.name);
    const archivedAt = text(row.archivedAt);
    if (!agencyId || !name || !archivedAt || Number.isNaN(Date.parse(archivedAt))) {
      return [];
    }
    return [
      {
        agencyId,
        name,
        kind: row.kind === "personal" ? "personal" : "agency",
        productMode: agencyModeFrom(row.productMode ?? "racing"),
        archivedAt,
        archivedBy: text(row.archivedBy),
        testOf: text(row.testOf),
      },
    ];
  });
}

const MODE_LABELS: Record<AgencyMode, string> = {
  racing: "Hípica",
  lottery: "Lotería",
  both: "Hípica y lotería",
};

/** The day it was removed, in Argentina: 06/11/2026. */
export function archivedDay(archivedAt: string): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(archivedAt));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}`;
}

/** What the row says under the name: what it is, and when and by whom it was removed. */
export function archivedAgencyDetail(agency: ArchivedAgency): string {
  const what = agency.kind === "personal" ? (agency.testOf ? `Prueba de ${agency.testOf}` : "Prueba") : MODE_LABELS[agency.productMode];
  const by = agency.archivedBy ? ` por ${agency.archivedBy}` : "";
  return `${what}. Quitada el ${archivedDay(agency.archivedAt)}${by}.`;
}
