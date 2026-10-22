import type { SupabaseClient } from "@supabase/supabase-js";

import { LedgerError } from "../../domain/errors";
import type { LotteryRemote } from "./lottery-ledger";

/** Reads and writes only lottery_ledgers. The racing ledgers table is not touched. */
export function createSupabaseLotteryRemote(client: SupabaseClient): LotteryRemote {
  return {
    async read(agencyId) {
      const { data, error } = await client
        .from("lottery_ledgers")
        .select("snapshot, version")
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) {
        throw new LedgerError("save-failed");
      }
      if (!data || typeof data !== "object") {
        return null;
      }
      return { snapshot: data.snapshot, version: data.version };
    },
    async insert(agencyId, snapshot) {
      const { error } = await client.from("lottery_ledgers").insert({ agency_id: agencyId, snapshot, version: 1 });
      if (!error) {
        return "created";
      }
      if (error.code === "23505") {
        return "exists";
      }
      throw new LedgerError("save-failed");
    },
    async update(agencyId, snapshot, expectedVersion) {
      const { data, error } = await client
        .from("lottery_ledgers")
        .update({ snapshot, version: expectedVersion + 1 })
        .eq("agency_id", agencyId)
        .eq("version", expectedVersion)
        .select("version")
        .maybeSingle();
      if (error) {
        throw new LedgerError("save-failed");
      }
      if (!data || typeof data.version !== "number") {
        return "conflict";
      }
      return data.version;
    },
  };
}
