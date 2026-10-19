import { bettorPlayAmounts } from "../../domain/bettor-account";
import type { Cents } from "../../domain/money";
import { listRacetracks } from "../../domain/racetracks";
import type { CashDay, CashExpense, CashIncome, CashIncomeKind, LedgerSnapshot, TerminalId } from "../../domain/types";

export type CashSource = "" | "de Carga" | "de Cuentas" | "de Efectivo que entró" | "de Gastos de la caja";

export type CashLine = {
  key: string;
  label: string;
  cents: Cents;
  source: CashSource;
};

export type CashPersonLine = {
  id: string;
  bettorId: string;
  name: string;
  cents: Cents;
};

export type CashMachineLine = {
  id: string;
  racetrackName: string;
  terminalId?: TerminalId;
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
};

/** What the screen is typing. The saved day stays in the book until Guardar caja. */
export type CashDayDraft = {
  openingCents: Cents;
  commissionCents: Cents;
  otherSalesCents: Cents;
  salesTaxCents: Cents;
  otherPaymentsCents: Cents;
  bankOutCents: Cents;
  personalWithdrawalCents: Cents;
  countedCents: Cents | null;
  incomes: readonly CashIncome[];
  expenses: readonly CashExpense[];
};

export type CashSummary = {
  date: string;
  saved: boolean;
  plus: CashLine[];
  minus: CashLine[];
  plusCents: Cents;
  minusCents: Cents;
  totalCents: Cents;
  countedCents: Cents | null;
  differenceCents: Cents | null;
  suggestedOpeningCents: Cents | null;
  openingCents: Cents;
  incomes: CashIncome[];
  incomeTotalCents: Cents;
  expenses: CashExpense[];
  collections: CashPersonLine[];
  debts: CashPersonLine[];
  machine: CashMachineLine[];
};

export function incomeKindLabel(kind: CashIncomeKind): string {
  if (kind === "bank") {
    return "Efectivo del banco";
  }
  if (kind === "partner") {
    return "Efectivo de un socio";
  }
  return "Otro efectivo";
}

function sumKind(incomes: readonly CashIncome[], kind: CashIncomeKind): Cents {
  return incomes.filter((income) => income.kind === kind).reduce((total, income) => total + income.amountCents, 0);
}

function automatic(snapshot: LedgerSnapshot, date: string): {
  soldCents: Cents;
  cancelledCents: Cents;
  paidCents: Cents;
  collections: CashPersonLine[];
  debts: CashPersonLine[];
  machine: CashMachineLine[];
} {
  const tracks = new Map(listRacetracks(snapshot).map((track) => [track.id, track.name]));
  let soldCents = 0;
  let cancelledCents = 0;
  let paidCents = 0;
  const machine: CashMachineLine[] = [];
  for (const day of snapshot.days) {
    if (day.agencyId !== snapshot.agencyId || day.date !== date) {
      continue;
    }
    soldCents += day.soldCents;
    cancelledCents += day.cancelledCents;
    paidCents += day.paidCents;
    machine.push({
      id: day.id,
      racetrackName: tracks.get(day.racetrackId) ?? day.racetrackId,
      terminalId: day.terminalId,
      soldCents: day.soldCents,
      cancelledCents: day.cancelledCents,
      paidCents: day.paidCents,
    });
  }

  const collections: CashPersonLine[] = [];
  for (const payment of snapshot.bettorPayments ?? []) {
    if (payment.agencyId !== snapshot.agencyId || payment.date !== date) {
      continue;
    }
    const name = snapshot.bettors?.find((bettor) => bettor.id === payment.bettorId)?.name ?? "Apostador";
    collections.push({ id: payment.id, bettorId: payment.bettorId, name, cents: payment.amountCents });
  }

  const debts: CashPersonLine[] = [];
  for (const play of snapshot.bettorPlays ?? []) {
    if (play.agencyId !== snapshot.agencyId || play.date !== date) {
      continue;
    }
    const stake = bettorPlayAmounts(play).stakeCents;
    if (stake === 0) {
      continue;
    }
    const name = snapshot.bettors?.find((bettor) => bettor.id === play.bettorId)?.name ?? "Apostador";
    debts.push({ id: play.id, bettorId: play.bettorId, name, cents: stake });
  }

  return { soldCents, cancelledCents, paidCents, collections, debts, machine };
}

function blankDay(agencyId: string, date: string): CashDay {
  return {
    id: "",
    agencyId,
    date,
    openingCents: 0,
    commissionCents: 0,
    otherSalesCents: 0,
    salesTaxCents: 0,
    otherPaymentsCents: 0,
    bankOutCents: 0,
    personalWithdrawalCents: 0,
    incomes: [],
    expenses: [],
  };
}

export function cashDayTotal(snapshot: LedgerSnapshot, day: CashDay): Cents {
  const auto = automatic(snapshot, day.date);
  const income = day.incomes.reduce((total, item) => total + item.amountCents, 0);
  const expense = day.expenses.reduce((total, item) => total + item.amountCents, 0);
  const collected = auto.collections.reduce((total, item) => total + item.cents, 0);
  const owed = auto.debts.reduce((total, item) => total + item.cents, 0);
  const plus =
    day.openingCents +
    auto.soldCents +
    day.commissionCents +
    day.otherSalesCents +
    collected +
    income;
  const minus =
    auto.paidCents +
    auto.cancelledCents +
    day.salesTaxCents +
    day.otherPaymentsCents +
    expense +
    owed +
    day.bankOutCents +
    day.personalWithdrawalCents;
  return plus - minus;
}

export function findCashDay(snapshot: LedgerSnapshot, date: string): CashDay | undefined {
  return (snapshot.cashDays ?? []).find((day) => day.agencyId === snapshot.agencyId && day.date === date);
}

export function suggestedOpeningCents(snapshot: LedgerSnapshot, date: string): Cents | null {
  const earlier = (snapshot.cashDays ?? [])
    .filter((day) => day.agencyId === snapshot.agencyId && day.date < date)
    .sort((left, right) => right.date.localeCompare(left.date));
  const previous = earlier[0];
  if (!previous) {
    return null;
  }
  return cashDayTotal(snapshot, previous);
}

export function summarizeCashDay(snapshot: LedgerSnapshot, date: string, draft?: CashDayDraft): CashSummary {
  const saved = findCashDay(snapshot, date);
  const suggested = suggestedOpeningCents(snapshot, date);
  const stored = saved ?? { ...blankDay(snapshot.agencyId, date), openingCents: suggested ?? 0 };
  const day: CashDay = draft
    ? {
        ...stored,
        openingCents: draft.openingCents,
        commissionCents: draft.commissionCents,
        otherSalesCents: draft.otherSalesCents,
        salesTaxCents: draft.salesTaxCents,
        otherPaymentsCents: draft.otherPaymentsCents,
        bankOutCents: draft.bankOutCents,
        personalWithdrawalCents: draft.personalWithdrawalCents,
        incomes: [...draft.incomes],
        expenses: [...draft.expenses],
      }
    : stored;
  const auto = automatic(snapshot, date);
  const bankIn = sumKind(day.incomes, "bank");
  const partnerIn = sumKind(day.incomes, "partner");
  const otherIn = sumKind(day.incomes, "other");
  const expense = day.expenses.reduce((total, item) => total + item.amountCents, 0);
  const collected = auto.collections.reduce((total, item) => total + item.cents, 0);
  const owed = auto.debts.reduce((total, item) => total + item.cents, 0);
  const plus: CashLine[] = [
    { key: "opening", label: "Inicio de caja", cents: day.openingCents, source: "" },
    { key: "sold", label: "Ventas máquina", cents: auto.soldCents, source: "de Carga" },
    { key: "commission", label: "Comisión", cents: day.commissionCents, source: "" },
    { key: "other-sales", label: "Otras ventas", cents: day.otherSalesCents, source: "" },
    { key: "collections", label: "Cobro de deudas", cents: collected, source: "de Cuentas" },
    { key: "bank-in", label: "Ing. banco", cents: bankIn, source: "de Efectivo que entró" },
    { key: "partner-in", label: "Ing. personal", cents: partnerIn, source: "de Efectivo que entró" },
    { key: "other-in", label: "Otros ingresos", cents: otherIn, source: "de Efectivo que entró" },
  ];
  const minus: CashLine[] = [
    { key: "paid", label: "Pago máquina", cents: auto.paidCents, source: "de Carga" },
    { key: "cancelled", label: "Cancelados", cents: auto.cancelledCents, source: "de Carga" },
    { key: "sales-tax", label: "Imp. de ventas", cents: day.salesTaxCents, source: "" },
    { key: "other-payments", label: "Pago varios", cents: day.otherPaymentsCents, source: "" },
    { key: "expenses", label: "Gastos varios", cents: expense, source: "de Gastos de la caja" },
    { key: "debts", label: "Deudas del día", cents: owed, source: "de Cuentas" },
    { key: "bank-out", label: "Banco", cents: day.bankOutCents, source: "" },
    { key: "withdrawal", label: "Retiro personal", cents: day.personalWithdrawalCents, source: "" },
  ];
  const plusCents = plus.reduce((total, line) => total + line.cents, 0);
  const minusCents = minus.reduce((total, line) => total + line.cents, 0);
  const totalCents = plusCents - minusCents;
  const countedCents = draft ? draft.countedCents : (saved?.countedCents ?? null);
  return {
    date,
    saved: Boolean(saved),
    plus,
    minus,
    plusCents,
    minusCents,
    totalCents,
    countedCents,
    differenceCents: countedCents === null ? null : countedCents - totalCents,
    suggestedOpeningCents: suggested,
    openingCents: day.openingCents,
    incomes: day.incomes,
    incomeTotalCents: bankIn + partnerIn + otherIn,
    expenses: day.expenses,
    collections: auto.collections,
    debts: auto.debts,
    machine: auto.machine,
  };
}
