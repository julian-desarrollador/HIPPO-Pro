import type { Cents } from "./money";

export type RacetrackId = "san-isidro" | "palermo" | "la-plata";

export type ViewerRole = "owner" | "operator";

export type ExpenseKind = "agency" | "partner-withdrawal";

export type DailySale = {
  id: string;
  agencyId: string;
  date: string;
  racetrackId: RacetrackId;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
};

export type HippodromeDeposit = {
  id: string;
  agencyId: string;
  date: string;
  racetrackId: RacetrackId;
  amountCents: Cents;
};

export type Expense = {
  id: string;
  agencyId: string;
  month: string;
  paidOn: string;
  categoryId: string;
  detail: string;
  amountCents: Cents;
  kind: ExpenseKind;
};

export type OpeningBalance = {
  racetrackId: RacetrackId;
  amountCents: Cents;
};

export type LedgerSnapshot = {
  agencyId: string;
  month: string;
  days: DailySale[];
  deposits: HippodromeDeposit[];
  expenses: Expense[];
  openingBalances: OpeningBalance[];
};
