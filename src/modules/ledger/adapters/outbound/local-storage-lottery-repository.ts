import type { LotteryRepository } from "../../application/ports/lottery-repository";
import type { LotterySnapshot } from "../../domain/lottery";
import type { JsonStorage } from "./local-storage-ledger-repository";
import { isLotterySnapshot } from "./lottery-snapshot";

/** Apart from hippo-pro.ledger.v1, so the racing book in this browser never changes. */
export const LOTTERY_STORAGE_KEY = "hippo-pro.lottery.v1";

function readStored(storage: JsonStorage): LotterySnapshot | null {
  try {
    const raw = storage.getItem(LOTTERY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isLotterySnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createLocalStorageLotteryRepository(storage: JsonStorage): LotteryRepository {
  let current = readStored(storage);
  return {
    load: () => (current ? structuredClone(current) : null),
    save: (snapshot) => {
      current = structuredClone(snapshot);
      try {
        storage.setItem(LOTTERY_STORAGE_KEY, JSON.stringify(current));
      } catch {
        // Quota or private mode: keep going with the in-memory copy.
      }
    },
  };
}
