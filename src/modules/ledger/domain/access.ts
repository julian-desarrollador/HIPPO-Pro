import type { AuditEntry, ViewerRole } from "./types";

export function canViewAgencyBalances(role: ViewerRole): boolean {
  return role === "owner";
}

/** Owner advances and withdrawals stay out of the operator's view. */
export function canViewPartnerWithdrawals(role: ViewerRole): boolean {
  return role === "owner";
}

/** History rows about owner-only money stay out of the operator's view. */
export function visibleAuditEntries(entries: readonly AuditEntry[], role: ViewerRole): readonly AuditEntry[] {
  return canViewPartnerWithdrawals(role) ? entries : entries.filter((entry) => !entry.ownerOnly);
}
