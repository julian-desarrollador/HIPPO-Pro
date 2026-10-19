import type { Cents } from "./money";

export type RacetrackId = string;

export type AgencyRacetrack = {
  id: RacetrackId;
  name: string;
  commissionBasisPoints: number;
  depositAdjustmentBasisPoints: number;
};

export type AgencyExpenseCategory = {
  id: string;
  label: string;
  kind: "agency";
};

export type ViewerRole = "owner" | "operator";

export type ExpenseKind = "agency" | "partner-withdrawal";

export type TerminalId = "1" | "2" | "3" | "4";

export type DailySale = {
  id: string;
  agencyId: string;
  date: string;
  racetrackId: RacetrackId;
  /** Missing on a day loaded before terminals were stored. That row occupies the whole date and racetrack. */
  terminalId?: TerminalId;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
  /** Copied from the racetrack when the day is recorded. Missing on the August seed. */
  commissionBasisPoints?: number;
  /** Copied from the racetrack when the day is recorded. Missing on the August seed. */
  depositAdjustmentBasisPoints?: number;
};

export type RacetrackCommission = {
  racetrackId: RacetrackId;
  commissionBasisPoints: number;
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

/** Legacy days stored before the dividend. New days omit it. */
export type PlayOutcome = "won" | "lost";

export type Bettor = {
  id: string;
  name: string;
};

export type BettorPlay = {
  id: string;
  agencyId: string;
  bettorId: string;
  date: string;
  /** What the bettor wagered that day. */
  amountCents: Cents;
  /**
   * Pari-mutuel dividend paid on the tickets, stake included.
   * Zero when nothing was collected. Missing only on legacy won/lost rows.
   */
  payoutCents?: Cents;
  outcome?: PlayOutcome;
};

export type BettorPayment = {
  id: string;
  agencyId: string;
  bettorId: string;
  date: string;
  amountCents: Cents;
};

export type CategoryLabel = {
  id: string;
  label: string;
};

export type CashIncomeKind = "bank" | "partner" | "other";

export type CashIncome = {
  id: string;
  kind: CashIncomeKind;
  detail: string;
  amountCents: Cents;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type CashExpense = {
  id: string;
  detail: string;
  amountCents: Cents;
};

/** One cash close for a date. Automatic lines are not stored: they come from the day and the bettors. */
export type CashDay = {
  id: string;
  agencyId: string;
  date: string;
  openingCents: Cents;
  commissionCents: Cents;
  otherSalesCents: Cents;
  salesTaxCents: Cents;
  otherPaymentsCents: Cents;
  bankOutCents: Cents;
  personalWithdrawalCents: Cents;
  countedCents?: Cents;
  incomes: CashIncome[];
  expenses: CashExpense[];
};

/** A person who appears on the schedule and does not sign in. */
export type StaffMember = {
  id: string;
  agencyId: string;
  name: string;
};

export type SchedulePerson = {
  id: string;
  name: string;
};

export type ScheduleDay = {
  id: string;
  agencyId: string;
  date: string;
  racetrackIds: string[];
  people: SchedulePerson[];
  inactive: boolean;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: ViewerRole;
  /** Name of the signed-in person. Rows written before this field stay without it. */
  actorName?: string;
  summary: string;
};

export type LedgerSnapshot = {
  agencyId: string;
  month: string;
  days: DailySale[];
  deposits: HippodromeDeposit[];
  expenses: Expense[];
  openingBalances: OpeningBalance[];
  /** Current commission per racetrack. Missing means the fixed table in racetracks.ts. */
  commissions?: RacetrackCommission[];
  /** Added racetracks, plus edits of the three fixed ones. The id of those three does not change. */
  racetracks?: AgencyRacetrack[];
  /** Fixed racetracks removed after they had no days or deposits. */
  hiddenRacetrackIds?: string[];
  /** Expense categories added from Gastos. */
  expenseCategories?: AgencyExpenseCategory[];
  /** New labels for the August categories. The id and kind stay. */
  categoryLabels?: CategoryLabel[];
  /** August categories removed after they had no expenses. */
  hiddenCategoryIds?: string[];
  /** Bettors added from Cuentas. Missing on the August seed. */
  bettors?: Bettor[];
  bettorPlays?: BettorPlay[];
  bettorPayments?: BettorPayment[];
  /** Who changed the book. Missing on the August seed. */
  audit?: AuditEntry[];
  /** Daily cash closes. Missing on the August seed. */
  cashDays?: CashDay[];
  /** People without an account, for the schedule. Missing on the August seed. */
  staff?: StaffMember[];
  /** Who works each day. Missing on the August seed. */
  schedule?: ScheduleDay[];
};
