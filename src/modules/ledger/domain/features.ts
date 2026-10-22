const LOTTERY_AGENCY_IDS: readonly string[] = ["agencia-dolores"];

/** Agencies that see Agencia de Quiniela. The racing book never depends on this. */
export function lotteryAvailable(agencyId: string): boolean {
  return LOTTERY_AGENCY_IDS.includes(agencyId);
}
