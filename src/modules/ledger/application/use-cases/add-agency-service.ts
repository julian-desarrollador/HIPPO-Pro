import { LedgerError } from "../../domain/errors";
import { withService, type AgencyMode, type AgencyService } from "../../domain/features";

/** The mode after the owner adds the missing service. Never removes one. */
export function addAgencyService(mode: AgencyMode, service: AgencyService): AgencyMode {
  const next = withService(mode, service);
  if (next === mode) {
    throw new LedgerError("service-already-on");
  }
  return next;
}
