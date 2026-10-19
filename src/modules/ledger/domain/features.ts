/** Agencia Dolores is the only book where cash and the schedule are on, while they are being tried. */
export const CASH_AND_SCHEDULE_AGENCY_ID = "agencia-dolores";

export function cashAndScheduleEnabled(agencyId: string): boolean {
  return agencyId === CASH_AND_SCHEDULE_AGENCY_ID;
}
