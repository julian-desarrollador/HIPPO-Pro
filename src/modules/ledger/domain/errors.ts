export type LedgerErrorCode =
  | "unknown-racetrack"
  | "unknown-category"
  | "negative-amount"
  | "invalid-amount"
  | "empty-entry"
  | "duplicate-day"
  | "invalid-date"
  | "outside-month";

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode) {
    super(code);
    this.name = "LedgerError";
    this.code = code;
  }
}
