import { LedgerError } from "../../domain/errors";
import { withoutService, type AgencyMode, type AgencyService } from "../../domain/features";

/** The mode after the owner turns one service off. One service always stays. */
export function removeAgencyService(mode: AgencyMode, service: AgencyService): AgencyMode {
  const next = withoutService(mode, service);
  if (next === mode) {
    throw new LedgerError("service-required");
  }
  return next;
}
