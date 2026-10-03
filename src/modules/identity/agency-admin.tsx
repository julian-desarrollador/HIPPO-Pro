import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { newAgencyProblem } from "./agency-invite";
import { readFunctionMessage } from "./operator-admin";

export type AgencyEntry = {
  agencyId: string;
  name: string;
};

type AgencyAdmin = {
  list: () => Promise<AgencyEntry[]>;
  create: (agencyName: string, ownerName: string, ownerEmail: string) => Promise<string | null>;
};

const AgencyAdminContext = createContext<AgencyAdmin | null>(null);

function isAgencyEntry(value: unknown): value is AgencyEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.agencyId === "string" && typeof row.name === "string";
}

function createAgencyAdmin(client: SupabaseClient): AgencyAdmin {
  return {
    async list() {
      const { data, error } = await client.functions.invoke("create-agency", { body: { action: "list" } });
      const agencies: unknown = data && typeof data === "object" && "agencies" in data ? data.agencies : null;
      if (error || !Array.isArray(agencies)) {
        throw new Error("agencies");
      }
      return agencies.filter(isAgencyEntry);
    },
    async create(agencyName, ownerName, ownerEmail) {
      const problem = newAgencyProblem(agencyName, ownerName, ownerEmail);
      if (problem) {
        return problem;
      }
      const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
      const { data, error } = await client.functions.invoke("create-agency", {
        body: {
          action: "create",
          agencyName: agencyName.trim(),
          ownerName: ownerName.trim(),
          ownerEmail: ownerEmail.trim(),
          redirectTo,
        },
      });
      return error ? readFunctionMessage(error, data) : null;
    },
  };
}

export function AgencyAdminProvider({
  client,
  enabled,
  children,
}: {
  client: SupabaseClient;
  enabled: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => (enabled ? createAgencyAdmin(client) : null), [client, enabled]);
  return <AgencyAdminContext.Provider value={value}>{children}</AgencyAdminContext.Provider>;
}

export function useAgencyAdmin(): AgencyAdmin | null {
  return useContext(AgencyAdminContext);
}
