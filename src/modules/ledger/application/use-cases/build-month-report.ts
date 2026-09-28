import { formatCents } from "../../domain/money";
import type { MonthSummary } from "./summarize-month";

const MONTH_LABELS: Record<string, string> = {
  "2026-08": "Agosto 2026",
};

export function buildMonthReport(summary: MonthSummary): string {
  const monthLabel = MONTH_LABELS[summary.month] ?? summary.month;
  const lines = [
    `HIPPO Pro · Agencia Dolores · ${monthLabel}`,
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
