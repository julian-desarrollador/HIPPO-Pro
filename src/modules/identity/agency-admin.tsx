import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { agencyModeFrom, type AgencyMode } from "@/modules/ledger";

import { archivedAgenciesFrom, type ArchivedAgency } from "./archived-agency";
import { openedAgencyFrom, type OpenedAgency } from "./opened-agency";

import { newAgencyProblem, personalAgencyNameProblem, removalNameMatches } from "./agency-invite";
import { joinNotice } from "./memberships";
import { readFunctionError, readFunctionMessage } from "./operator-admin";

export type { ArchivedAgency } from "./archived-agency";
export type { OpenedAgency } from "./opened-agency";

/** personal: the caller's own test. test: someone else's, listed only for whoever manages the trash. */
export type AgencyKind = "home" | "personal" | "test" | "other";

export type AgencyEntry = {
  agencyId: string;
  name: string;
  kind: AgencyKind;
  productMode: AgencyMode;
  /** Whose test it is, for kind test. Empty otherwise. */
  testOf: string;
};

/**
 * created: notice says what to tell when the owner's email already had an account.
 * name-taken: a live agency has that name; nothing was created, it can go on anyway.
 * existing-account: the owner's email already has an account; nothing was created yet.
 */
export type CreateAgencyResult =
  | { status: "created"; notice: string | null }
  | { status: "name-taken"; message: string }
  | { status: "existing-account"; message: string }
  | { status: "error"; message: string };

/** What the person already confirmed, so the function does not ask again. */
export type CreateAgencyOptions = { allowDuplicateName?: boolean; confirmExisting?: boolean };

export type CreatedPersonalAgency = {
  agencyId: string;
  name: string;
};

type AgencyAdmin = {
  list: () => Promise<AgencyEntry[]>;
  create: (
    agencyName: string,
    ownerName: string,
    ownerEmail: string,
    productMode: AgencyMode,
    options?: CreateAgencyOptions,
  ) => Promise<CreateAgencyResult>;
  createPersonal: (agencyName: string, productMode: AgencyMode) => Promise<CreatedPersonalAgency | string>;
  removePersonal: (agencyId: string) => Promise<string | null>;
  /** Hides a real agency and closes its sign-in. Its data stays in the base. */
  archive: (agency: AgencyEntry, confirmName: string) => Promise<string | null>;
  read: (agencyId: string) => Promise<OpenedAgency | string>;
  /** The trash. Only an account with can_manage_trash gets an answer. */
  listArchived: () => Promise<ArchivedAgency[]>;
  /** Back to the list, and its people can sign in again. */
  restore: (agency: ArchivedAgency) => Promise<string | null>;
  /** Deletes the books, the photos and the accounts that were only in it. */
  purge: (agency: ArchivedAgency, confirmName: string) => Promise<string | null>;
};

const AgencyAdminContext = createContext<AgencyAdmin | null>(null);

function isAgencyKind(value: unknown): value is AgencyKind {
  return value === "home" || value === "personal" || value === "test" || value === "other";
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
    testOf: row.kind === "test" && typeof row.testOf === "string" ? row.testOf.trim() : "",
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
    async create(agencyName, ownerName, ownerEmail, productMode, options = {}) {
      const problem = newAgencyProblem(agencyName, ownerName, ownerEmail);
      if (problem) {
        return { status: "error", message: problem };
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
          allowDuplicateName: options.allowDuplicateName === true,
          confirmExisting: options.confirmExisting === true,
        },
      });
      if (error) {
        const { message, code } = await readFunctionError(error, data);
        if (code === "name-taken" || code === "existing-account") {
          return { status: code, message };
        }
        return { status: "error", message };
      }
      return { status: "created", notice: joinNotice(data, ownerEmail) };
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
    async archive(agency, confirmName) {
      if (!removalNameMatches(confirmName, agency.name)) {
        return "El nombre no coincide.";
      }
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "archive", agencyId: agency.agencyId, confirmName: confirmName.trim() },
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
      return openedAgencyFrom(data, agencyId) ?? "No se pudo abrir la agencia.";
    },
    async listArchived() {
      const { data, error } = await client.functions.invoke("create-agency", { body: { action: "list-archived" } });
      const agencies = error ? null : archivedAgenciesFrom(data);
      if (!agencies) {
        throw new Error("archived");
      }
      return agencies;
    },
    async restore(agency) {
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "restore", agencyId: agency.agencyId },
      });
      return error ? readFunctionMessage(error, data) : null;
    },
    async purge(agency, confirmName) {
      if (!removalNameMatches(confirmName, agency.name)) {
        return "El nombre no coincide.";
      }
      const { data, error } = await client.functions.invoke("create-agency", {
        body: { action: "purge", agencyId: agency.agencyId, confirmName: confirmName.trim() },
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
