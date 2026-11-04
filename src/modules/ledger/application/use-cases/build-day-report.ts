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
    profitShareBasisPoints: day.profitShareBasisPoints,
  });
  const title = day.terminalId ? `${day.racetrackName} · Terminal ${day.terminalId}` : day.racetrackName;
  if (settlement.profitShareBasisPoints !== undefined) {
    return [
      title,
      `Vendido: ${formatCents(day.soldCents)}`,
      `Cancelados: ${formatCents(day.cancelledCents)}`,
      `Neto: ${formatCents(settlement.netCents)}`,
      `Pagado: ${formatCents(day.paidCents)}`,
      `Ganancia del día: ${formatCents(settlement.dayGainCents)}`,
      `Agencia ${formatSignedPercent(settlement.commissionBasisPoints)} del neto: ${formatCents(settlement.netShareCents)}`,
      `Agencia ${formatSignedPercent(settlement.profitShareBasisPoints)} de la ganancia: ${formatCents(settlement.profitShareCents)}`,
      `Comisión total: ${formatCents(settlement.commissionCents)}`,
      `A depositar: ${formatCents(settlement.amountToDepositCents)}`,
    ].join("\n");
  }
  return [
    title,
    `Vendido: ${formatCents(day.soldCents)}`,
    `Cancelados: ${formatCents(day.cancelledCents)}`,
    `Neto: ${formatCents(settlement.netCents)}`,
    `Comisión (${formatSignedPercent(settlement.commissionBasisPoints)}): ${formatCents(settlement.commissionCents)}`,
    `Pagado: ${formatCents(day.paidCents)}`,
    `A depositar: ${formatCents(settlement.amountToDepositCents)}`,
  ].join("\n");
}

export const emptyDayReportMessage = "Cargá el día antes de compartirlo.";

export function buildDayReport(days: readonly SettledDay[], date: string, agencyName: string): string | null {
  const matches = days.filter((day) => day.date === date);
  if (matches.length === 0) {
    return null;
  }
  const blocks = matches.map(trackBlock).join("\n\n");
  return [`HippoPro · ${agencyName} · ${formatDay(date)}`, "", blocks].join("\n");
}
