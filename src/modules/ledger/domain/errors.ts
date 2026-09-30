export type LedgerErrorCode =
  | "unknown-racetrack"
  | "unknown-category"
  | "negative-amount"
  | "invalid-amount"
  | "empty-entry"
  | "duplicate-day"
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
  | "bettor-in-use";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode) {
    super(code);
    this.name = "LedgerError";
    this.code = code;
  }
}
