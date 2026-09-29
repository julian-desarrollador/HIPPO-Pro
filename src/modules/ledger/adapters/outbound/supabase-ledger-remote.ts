import type { SupabaseClient } from "@supabase/supabase-js";

import { LedgerError } from "../../domain/errors";
import type { LedgerSnapshot } from "../../domain/types";
import type { LedgerRemote, LedgerRemoteRow } from "./agency-ledger";

type LedgerTableRow = {
  snapshot: unknown;
  version: number;
};

function asRow(value: unknown): LedgerRemoteRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as LedgerTableRow;
  return { snapshot: row.snapshot, version: row.version };
}

export function createSupabaseLedgerRemote(client: SupabaseClient): LedgerRemote {
  return {
    async read(agencyId) {
      const { data, error } = await client.from("ledgers").select("snapshot, version").eq("agency_id", agencyId).maybeSingle();
      if (error) {
        throw new LedgerError("save-failed");
      }
      return asRow(data);
    },
    async insert(agencyId, snapshot: LedgerSnapshot) {
      const { error } = await client.from("ledgers").insert({ agency_id: agencyId, snapshot, version: 1 });
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
        .from("ledgers")
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
