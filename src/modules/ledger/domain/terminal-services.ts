import { LedgerError } from "./errors";
import { isTerminalId } from "./lottery";
import type { LedgerSnapshot, TerminalId } from "./types";

/** Which books a terminal may load. Missing means both are on. */
export type TerminalServiceSet = {
  terminalId: TerminalId;
  racing: boolean;
  lottery: boolean;
};

export function terminalServices(
  snapshot: LedgerSnapshot,
  terminalId: TerminalId,
): { racing: boolean; lottery: boolean } {
  const row = snapshot.terminalServices?.find((item) => item.terminalId === terminalId);
  if (!row || (!row.racing && !row.lottery)) {
    return { racing: true, lottery: true };
  }
  return { racing: row.racing, lottery: row.lottery };
}

/** Turns services on or off. Days stay as they are, including August rows with no terminal. */
export function withTerminalService(snapshot: LedgerSnapshot, next: TerminalServiceSet): LedgerSnapshot {
  if (!isTerminalId(next.terminalId)) {
    throw new LedgerError("unknown-terminal");
  }
  if (!next.racing && !next.lottery) {
    throw new LedgerError("terminal-needs-service");
  }
  const rest = (snapshot.terminalServices ?? []).filter((item) => item.terminalId !== next.terminalId);
  return {
    ...snapshot,
    terminalServices: [...rest, { terminalId: next.terminalId, racing: next.racing, lottery: next.lottery }],
  };
}
