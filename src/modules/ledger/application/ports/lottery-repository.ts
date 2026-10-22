import type { LotterySnapshot } from "../../domain/lottery";

/** The lottery book of one agency. Null until the owner activates it. */
export interface LotteryRepository {
  load(): LotterySnapshot | null;
  save(snapshot: LotterySnapshot): void;
}
