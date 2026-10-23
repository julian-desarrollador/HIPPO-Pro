import { withTerminalService, type TerminalServiceSet } from "../../domain/terminal-services";
import type { LedgerRepository } from "../ports/ledger-repository";

export function setTerminalServices(repository: LedgerRepository, input: TerminalServiceSet): void {
  repository.save(withTerminalService(repository.load(), input));
}
