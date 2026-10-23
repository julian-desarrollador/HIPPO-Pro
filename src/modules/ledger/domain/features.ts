/** What an agency uses. Missing or unknown values stay on racing. */
export type AgencyMode = "racing" | "lottery" | "both";

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
