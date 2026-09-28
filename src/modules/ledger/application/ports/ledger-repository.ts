import type { LedgerSnapshot } from "../../domain/types";

export interface LedgerRepository {
  load(): LedgerSnapshot;
  save(snapshot: LedgerSnapshot): void;
  reset(): void;
}
