import type { ViewerRole } from "./types";

export function canViewAgencyBalances(role: ViewerRole): boolean {
  return role === "owner";
}

/** Owner advances and withdrawals stay out of the operator's view. */
export function canViewPartnerWithdrawals(role: ViewerRole): boolean {
  return role === "owner";
}
