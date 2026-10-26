export type LedgerErrorCode =
  | "unknown-racetrack"
  | "unknown-category"
  | "negative-amount"
  | "invalid-amount"
  | "empty-entry"
  | "duplicate-day"
  | "duplicate-terminal"
  | "invalid-date"
  | "outside-month"
  | "unknown-entry"
  | "invalid-percent"
  | "save-failed"
  | "save-conflict"
  | "invalid-name"
  | "duplicate-racetrack"
  | "builtin-racetrack"
  | "racetrack-in-use"
  | "invalid-adjustment"
  | "duplicate-category"
  | "builtin-category"
  | "category-in-use"
  | "duplicate-bettor"
  | "unknown-bettor"
  | "bettor-in-use"
  | "duplicate-staff"
  | "unknown-staff"
  | "staff-in-use"
  | "unknown-cash"
  | "schedule-person-required"
  | "lottery-inactive"
  | "lottery-owner-only"
  | "unknown-game"
  | "unknown-terminal"
  | "terminal-needs-service"
  | "service-already-on"
  | "service-required"
  | "duplicate-lottery-day"
  | "agency-day-partial";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode) {
    super(code);
    this.name = "LedgerError";
    this.code = code;
  }
}
