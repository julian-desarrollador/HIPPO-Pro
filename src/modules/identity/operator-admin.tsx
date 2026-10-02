import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  invite: (displayName: string, email: string, role?: InviteRole, grantInvite?: boolean) => Promise<string | null>;
  remove: (userId: string) => Promise<string | null>;
};

const OperatorAdminContext = createContext<OperatorAdmin | null>(null);

const connectionProblem = "No se pudo completar. Revisá la conexión.";

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

async function readFunctionMessage(error: { context?: unknown }, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  const context = error.context;
  if (context && typeof context === "object" && "message" in context && typeof context.message === "string") {
    return context.message;
  }
  if (context instanceof Response) {
    try {
      const payload: unknown = await context.json();
      if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
        return payload.message;
      }
    } catch {
      // The function did not return JSON.
    }
  }
  return connectionProblem;
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
  canInviteOwners,
  children,
}: {
  client: SupabaseClient;
  canInviteOwners: boolean;
  children: ReactNode;
}) {
  const value = useMemo<OperatorAdmin>(
    () => ({
      async list() {
        const { data, error } = await client
          .from("profiles")
          .select("user_id, display_name, email, role")
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
      invite(displayName, email, role = "operator", grantInvite = false) {
        const problem = inviteMemberProblem(displayName, email, role, canInviteOwners);
        if (problem) {
          return Promise.resolve(problem);
        }
        const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
        return callFunction(client, {
          action: "invite",
          displayName: displayName.trim(),
          email: email.trim(),
          role,
          canInviteOwners: role === "owner" && grantInvite,
          redirectTo,
        });
      },
      remove(userId) {
        return callFunction(client, { action: "remove", userId });
      },
    }),
    [canInviteOwners, client],
  );

  return <OperatorAdminContext.Provider value={value}>{children}</OperatorAdminContext.Provider>;
}

export function useOperatorAdmin(): OperatorAdmin | null {
  return useContext(OperatorAdminContext);
}
