import type { ViewerRole } from "./types";

export function canViewAgencyBalances(role: ViewerRole): boolean {
  return role === "owner";
}
