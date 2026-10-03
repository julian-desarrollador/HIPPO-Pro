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

export function buildMonthReport(summary: MonthSummary, agencyName: string): string {
  const label = monthLabel(summary.month);
  const lines = [
    `HippoPro · ${agencyName} · ${label}`,
    `Venta neta: ${formatCents(summary.netCents)}`,
    `Ganancia de la agencia: ${formatCents(summary.billingCents)}`,
    `Gastos de la agencia: ${formatCents(summary.agencyExpenseCents)}`,
    `Retiros: ${formatCents(summary.partnerWithdrawalCents)}`,
    `Saldo del mes: ${formatCents(summary.balanceCents)}`,
    "",
    "A pagar por hipódromo:",
    ...summary.racetracks.map((racetrack) => `${racetrack.name}: ${formatCents(racetrack.owedCents)}`),
  ];
  return lines.join("\n");
}
