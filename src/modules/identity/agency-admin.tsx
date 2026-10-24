import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyModeFrom, type AgencyMode } from "@/modules/ledger";
import { isLedgerSnapshot } from "@/modules/ledger/adapters/outbound/ledger-snapshot";
import type { LedgerSnapshot } from "@/modules/ledger/domain/types";

import { newAgencyProblem, personalAgencyNameProblem } from "./agency-invite";
import { readFunctionMessage } from "./operator-admin";

export type OpenedAgency = {
  agencyId: string;
  agencyName: string;
  agencyMode: AgencyMode;
  snapshot: LedgerSnapshot;
};

export type AgencyKind = "home" | "personal" | "other";

export type AgencyEntry = {
  agencyId: string;
  name: string;
  kind: AgencyKind;
  productMode: AgencyMode;
};

export type CreatedPersonalAgency = {
  agencyId: string;
  name: string;
};

type AgencyAdmin = {
  list: () => Promise<AgencyEntry[]>;
  create: (agencyName: string, ownerName: string, ownerEmail: string, productMode: AgencyMode) => Promise<string | null>;
  createPersonal: (agencyName: string, productMode: AgencyMode) => Promise<CreatedPersonalAgency | string>;
  removePersonal: (agencyId: string) => Promise<string | null>;
  read: (agencyId: string) => Promise<OpenedAgency | string>;
};

const AgencyAdminContext = createContext<AgencyAdmin | null>(null);

function isAgencyKind(value: unknown): value is AgencyKind {
  return value === "home" || value === "personal" || value === "other";
}

function agencyEntryFrom(value: unknown): AgencyEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.agencyId !== "string" || typeof row.name !== "string" || !isAgencyKind(row.kind)) {
    return null;
  }
  return {
    agencyId: row.agencyId,
    name: row.name,
    kind: row.kind,
    productMode: agencyModeFrom(row.productMode),
  };
}

function createAgencyAdmin(client: SupabaseClient): AgencyAdmin {
  return {
    async list() {
      const { data, error } = await client.functions.invoke("create-agency", { body: { action: "list" } });
      const agencies: unknown = data && typeof data === "object" && "agencies" in data ? data.agencies : null;
      if (error || !Array.isArray(agencies)) {
        throw new Error("agencies");
      }
      return agencies.flatMap((row) => {
        const entry = agencyEntryFrom(row);
        return entry ? [entry] : [];
      });
    },
    async create(agencyName, ownerName, ownerEmail, productMode) {
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
          productMode,
          redirectTo,
        },
      });
      return error ? readFunctionMessage(error, data) : null;
    },
    async createPersonal(agencyName, productMode) {
      const problem = personalAgencyNameProblem(agencyName);
      if (problem) {
        return problem;
      }
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "create-personal", agencyName: agencyName.trim(), productMode },
      });
      if (error) {
        return readFunctionMessage(error, data);
      }
      const agencyId = data && typeof data === "object" && "agencyId" in data && typeof data.agencyId === "string" ? data.agencyId : "";
      const name = data && typeof data === "object" && "name" in data && typeof data.name === "string" ? data.name.trim() : "";
      if (!agencyId || !name) {
        return "No se pudo crear la agencia.";
      }
      return { agencyId, name };
    },
    async removePersonal(agencyId) {
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "delete-personal", agencyId },
      });
      return error ? readFunctionMessage(error, data) : null;
    },
    async read(agencyId) {
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "read", agencyId },
      });
      if (error) {
        return readFunctionMessage(error, data);
      }
      const name = data && typeof data === "object" && "name" in data && typeof data.name === "string" ? data.name.trim() : "";
      const snapshot = data && typeof data === "object" && "snapshot" in data ? data.snapshot : null;
      if (!name || !isLedgerSnapshot(snapshot) || snapshot.agencyId !== agencyId) {
        return "No se pudo abrir la agencia.";
      }
      return { agencyId, agencyName: name, agencyMode: agencyModeFrom(data && typeof data === "object" && "productMode" in data ? data.productMode : "racing"), snapshot };
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
