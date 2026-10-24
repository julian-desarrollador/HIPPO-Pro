/** What an agency uses. Missing or unknown values stay on racing. */
export type AgencyMode = "racing" | "lottery" | "both";

/** A service the owner can add. Adding never turns the other one off. */
export type AgencyService = "racing" | "lottery";

export function agencyModeFrom(value: unknown): AgencyMode {
  return value === "lottery" || value === "both" ? value : "racing";
}

export function seesRacing(mode: AgencyMode): boolean {
  return mode !== "lottery";
}

export function seesLottery(mode: AgencyMode): boolean {
  return mode !== "racing";
}

export function homeHref(mode: AgencyMode): "/" | "/quiniela" {
  return mode === "lottery" ? "/quiniela" : "/";
}

/** The service still missing, or null when the agency already uses both. */
export function canAddService(mode: AgencyMode): AgencyService | null {
  if (mode === "racing") {
    return "lottery";
  }
  if (mode === "lottery") {
    return "racing";
  }
  return null;
}

/** Turns the missing service on. A service that is already on stays as it is. */
export function withService(mode: AgencyMode, service: AgencyService): AgencyMode {
  if (canAddService(mode) !== service) {
    return mode;
  }
  return "both";
}

/** Turns one service off when both are on. Any other mode stays as it is. */
export function withoutService(mode: AgencyMode, service: AgencyService): AgencyMode {
  if (mode !== "both") {
    return mode;
  }
  return service === "lottery" ? "racing" : "lottery";
}
