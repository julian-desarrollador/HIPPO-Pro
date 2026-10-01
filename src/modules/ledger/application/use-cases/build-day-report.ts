import { settleDay } from "../../domain/calculations";
import { formatCents, formatSignedPercent } from "../../domain/money";
import type { SettledDay } from "./summarize-month";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

function trackBlock(day: SettledDay): string {
  const settlement = settleDay({
    racetrackId: day.racetrackId,
    soldCents: day.soldCents,
    cancelledCents: day.cancelledCents,
    paidCents: day.paidCents,
    commissionBasisPoints: day.commissionBasisPoints,
    depositAdjustmentBasisPoints: day.depositAdjustmentBasisPoints,
  });
  return [
    day.racetrackName,
    `Vendido: ${formatCents(day.soldCents)}`,
    `Cancelados: ${formatCents(day.cancelledCents)}`,
    `Neto: ${formatCents(settlement.netCents)}`,
    `Comisión (${formatSignedPercent(settlement.commissionBasisPoints)}): ${formatCents(settlement.commissionCents)}`,
    `Pagado: ${formatCents(day.paidCents)}`,
    `Ajuste (${formatSignedPercent(settlement.depositAdjustmentBasisPoints)}): ${formatCents(settlement.adjustmentCents)}`,
    `A depositar: ${formatCents(settlement.amountToDepositCents)}`,
  ].join("\n");
}

export const emptyDayReportMessage = "Cargá el día antes de compartirlo.";

export function buildDayReport(days: readonly SettledDay[], date: string): string | null {
  const matches = days.filter((day) => day.date === date);
  if (matches.length === 0) {
    return null;
  }
  const blocks = matches.map(trackBlock).join("\n\n");
  return [`HippoPro · Agencia Dolores · ${formatDay(date)}`, "", blocks].join("\n");
}
