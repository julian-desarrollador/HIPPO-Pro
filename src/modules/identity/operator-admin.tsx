import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { joinNotice } from "./memberships";
import { inviteMemberProblem, type InviteRole } from "./operator-invite";

export type AgencyOperator = {
  userId: string;
  displayName: string;
  email: string;
};

export type AgencyOwner = AgencyOperator & {
  canInviteOwners: boolean;
};

type OperatorAdmin = {
  list: () => Promise<AgencyOperator[]>;
  listOwners: () => Promise<AgencyOwner[]>;
  /**
   * problem: why it failed. notice: what to tell when the email already had an account.
   * needsConfirm: the email has an account and nothing was done yet; call again with confirmExisting.
   */
  invite: (
    displayName: string,
    email: string,
    role?: InviteRole,
    grantInvite?: boolean,
    confirmExisting?: boolean,
  ) => Promise<{ problem: string | null; notice: string | null; needsConfirm: boolean }>;
  remove: (userId: string) => Promise<string | null>;
};

const OperatorAdminContext = createContext<OperatorAdmin | null>(null);

export const connectionProblem = "No se pudo completar. Revisá la conexión.";

function isPersonRow(value: unknown): value is {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  can_invite_owners?: boolean;
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.user_id === "string" &&
    typeof row.display_name === "string" &&
    typeof row.email === "string" &&
    (row.role === "operator" || row.role === "owner")
  );
}

/** The message and, when there is one, the code a function answered with an error. */
export async function readFunctionError(error: { context?: unknown }, data: unknown): Promise<{ message: string; code: string }> {
  const pick = (value: unknown) => {
    if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
      const code = "code" in value && typeof value.code === "string" ? value.code : "";
      return { message: value.message, code };
    }
    return null;
  };
  const direct = pick(data) ?? (error.context instanceof Response ? null : pick(error.context));
  if (direct) {
    return direct;
  }
  const context = error.context;
  if (context instanceof Response) {
    try {
      const payload = pick(await context.json());
      if (payload) {
        return payload;
      }
    } catch {
      // The function did not return JSON.
    }
  }
  return { message: connectionProblem, code: "" };
}

export async function readFunctionMessage(error: { context?: unknown }, data: unknown): Promise<string> {
  return (await readFunctionError(error, data)).message;
}

async function callFunction(
  client: SupabaseClient,
  body: Record<string, unknown>,
): Promise<string | null> {
  const { data, error } = await client.functions.invoke("manage-operator", { body });
  if (!error) {
    return null;
  }
  return readFunctionMessage(error, data);
}

export function OperatorAdminProvider({
  client,
  agencyId,
  canInviteOwners,
  children,
}: {
  client: SupabaseClient;
  /** The agency open in this session. An account can be in several. */
  agencyId: string;
  canInviteOwners: boolean;
  children: ReactNode;
}) {
  const value = useMemo<OperatorAdmin>(
    () => ({
      async list() {
        const { data, error } = await client
          .from("profiles")
          .select("user_id, display_name, email, role")
          .eq("agency_id", agencyId)
          .eq("role", "operator")
          .order("display_name");
        if (error || !Array.isArray(data)) {
          throw new Error("operators");
        }
        return data.filter(isPersonRow).filter((row) => row.role === "operator").map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email,
        }));
      },
      async listOwners() {
        const { data, error } = await client
          .from("profiles")
          .select("user_id, display_name, email, role, can_invite_owners")
          .eq("agency_id", agencyId)
          .eq("role", "owner")
          .order("display_name");
        if (error || !Array.isArray(data)) {
          throw new Error("owners");
        }
        return data.filter(isPersonRow).filter((row) => row.role === "owner").map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email,
          canInviteOwners: row.can_invite_owners === true,
        }));
      },
      async invite(displayName, email, role = "operator", grantInvite = false, confirmExisting = false) {
        const problem = inviteMemberProblem(displayName, email, role, canInviteOwners);
        if (problem) {
          return { problem, notice: null, needsConfirm: false };
        }
        const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
        const { data, error } = await client.functions.invoke("manage-operator", {
          body: {
            action: "invite",
            agencyId,
            displayName: displayName.trim(),
            email: email.trim(),
            role,
            canInviteOwners: role === "owner" && grantInvite,
            redirectTo,
            confirmExisting,
          },
        });
        if (error) {
          const { message, code } = await readFunctionError(error, data);
          return code === "existing-account"
            ? { problem: null, notice: null, needsConfirm: true }
            : { problem: message, notice: null, needsConfirm: false };
        }
        return { problem: null, notice: joinNotice(data, email), needsConfirm: false };
      },
      remove(userId) {
        return callFunction(client, { action: "remove", agencyId, userId });
      },
    }),
    [agencyId, canInviteOwners, client],
  );

  return <OperatorAdminContext.Provider value={value}>{children}</OperatorAdminContext.Provider>;
}

export function useOperatorAdmin(): OperatorAdmin | null {
  return useContext(OperatorAdminContext);
}
