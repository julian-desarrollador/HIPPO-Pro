import { formatCents } from "../../domain/money";
import type { MonthSummary } from "./summarize-month";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const name = MONTH_NAMES[monthNumber - 1];
  return name ? `${name} ${year}` : month;
}

export function buildMonthReport(summary: MonthSummary): string {
  const label = monthLabel(summary.month);
  const lines = [
    `HippoPro · Agencia Dolores · ${label}`,
    `Facturación: ${formatCents(summary.billingCents)}`,
    `Gastos de la agencia: ${formatCents(summary.agencyExpenseCents)}`,
    `Adelantos y retiros: ${formatCents(summary.partnerWithdrawalCents)}`,
    `Salidas: ${formatCents(summary.outflowCents)}`,
    `Saldo del mes: ${formatCents(summary.balanceCents)}`,
    "",
    "A pagar por hipódromo:",
    ...summary.racetracks.map((racetrack) => `${racetrack.name}: ${formatCents(racetrack.owedCents)}`),
  ];
  return lines.join("\n");
}
