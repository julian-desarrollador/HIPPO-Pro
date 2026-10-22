import type { LotteryRepository } from "../../application/ports/lottery-repository";
import type { LotterySnapshot } from "../../domain/lottery";

export function createInMemoryLotteryRepository(initial: LotterySnapshot | null = null): LotteryRepository {
  let current = initial ? structuredClone(initial) : null;
  return {
    load: () => (current ? structuredClone(current) : null),
    save: (snapshot) => {
      current = structuredClone(snapshot);
    },
  };
}
