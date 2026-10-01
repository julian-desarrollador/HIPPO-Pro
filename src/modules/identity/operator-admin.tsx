import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { inviteOperatorProblem } from "./operator-invite";

export type AgencyOperator = {
  userId: string;
  displayName: string;
  email: string;
};

type OperatorAdmin = {
  list: () => Promise<AgencyOperator[]>;
  invite: (displayName: string, email: string) => Promise<string | null>;
  remove: (userId: string) => Promise<string | null>;
};

const OperatorAdminContext = createContext<OperatorAdmin | null>(null);

const connectionProblem = "No se pudo completar. Revisá la conexión.";

function isOperatorRow(value: unknown): value is {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.user_id === "string" &&
    typeof row.display_name === "string" &&
    typeof row.email === "string" &&
    row.role === "operator"
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
  children,
}: {
  client: SupabaseClient;
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
        return data.filter(isOperatorRow).map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email,
        }));
      },
      invite(displayName, email) {
        const problem = inviteOperatorProblem(displayName, email);
        if (problem) {
          return Promise.resolve(problem);
        }
        const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
        return callFunction(client, {
          action: "invite",
          displayName: displayName.trim(),
          email: email.trim(),
          redirectTo,
        });
      },
      remove(userId) {
        return callFunction(client, { action: "remove", userId });
      },
    }),
    [client],
  );

  return <OperatorAdminContext.Provider value={value}>{children}</OperatorAdminContext.Provider>;
}

export function useOperatorAdmin(): OperatorAdmin | null {
  return useContext(OperatorAdminContext);
}
