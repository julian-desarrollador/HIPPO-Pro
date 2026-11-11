// One account can be in several agencies (multi-agency.sql): one profiles row
// per person and agency. Shared by create-agency and manage-operator.
// Runs with the service role inside Supabase.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type JoinInput = {
  email: string;
  agencyId: string;
  role: "owner" | "operator";
  displayName: string;
  canInviteOwners: boolean;
  redirectTo: string;
  /** The person already said to go on with an email that has an account. */
  confirmExisting: boolean;
};

export type JoinResult =
  /** A new account: the invitation email went out. */
  | { kind: "invited"; userId: string }
  /** The email already had an account: the agency was added to it. */
  | { kind: "existing"; userId: string; passwordLinkSent: boolean }
  /** That account is already in this agency. Nothing changed. */
  | { kind: "already-in" }
  /** The email has an account and the person has not confirmed yet. Nothing changed. */
  | { kind: "needs-confirmation" }
  | { kind: "error"; status: number; message: string };

function alreadyRegistered(message: string): boolean {
  return /already|registered|exists/i.test(message);
}

/** The account with this email, or null. undefined when the lookup is not installed yet. */
export async function accountFor(admin: SupabaseClient, email: string): Promise<string | null | undefined> {
  const { data, error } = await admin.rpc("user_id_for_email", { target: email });
  if (error) {
    return undefined;
  }
  return typeof data === "string" && data ? data : null;
}

/**
 * Adds a person to an agency. A new email gets the invitation. An email with an
 * account gets the agency added to it, and, if it never chose a password, the
 * email to choose one. Before multi-agency.sql, an existing email still fails.
 */
export async function addPersonToAgency(admin: SupabaseClient, input: JoinInput): Promise<JoinResult> {
  const row = {
    agency_id: input.agencyId,
    role: input.role,
    display_name: input.displayName,
    email: input.email,
    can_invite_owners: input.role === "owner" && input.canInviteOwners,
    can_create_agencies: false,
  };

  const existingId = await accountFor(admin, input.email);
  if (existingId) {
    const { data: present, error: presentError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", existingId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (presentError) {
      return { kind: "error", status: 400, message: "No se pudo completar." };
    }
    if (present) {
      return { kind: "already-in" };
    }
    if (!input.confirmExisting) {
      return { kind: "needs-confirmation" };
    }
    const { error: insertError } = await admin.from("profiles").insert({ user_id: existingId, ...row });
    if (insertError) {
      return { kind: "error", status: 400, message: "No se pudo sumar a esa persona." };
    }
    // Never got in: no sign-in yet, or the password link was opened and not saved.
    const { data: userData } = await admin.auth.admin.getUserById(existingId);
    const user = userData?.user;
    const neverGotIn = !user?.last_sign_in_at || user.user_metadata?.password_pending === true;
    let passwordLinkSent = false;
    if (neverGotIn) {
      const { error: linkError } = await admin.auth.resetPasswordForEmail(input.email, { redirectTo: input.redirectTo });
      passwordLinkSent = !linkError;
    }
    return { kind: "existing", userId: existingId, passwordLinkSent };
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
    data: { password_pending: true },
  });
  if (inviteError || !invited.user) {
    const message = inviteError?.message ?? "";
    return alreadyRegistered(message)
      ? { kind: "error", status: 409, message: "Ese correo ya tiene una cuenta." }
      : { kind: "error", status: 400, message: "No se pudo enviar la invitación." };
  }
  const { error: profileError } = await admin.from("profiles").insert({ user_id: invited.user.id, ...row });
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { kind: "error", status: 400, message: "No se pudo sumar a esa persona." };
  }
  return { kind: "invited", userId: invited.user.id };
}

/**
 * Takes a person out of one agency. The account itself goes only when no other
 * agency is left. Returns false when something could not be deleted.
 */
export async function removePersonFromAgency(admin: SupabaseClient, userId: string, agencyId: string): Promise<boolean> {
  const { error } = await admin.from("profiles").delete().eq("user_id", userId).eq("agency_id", agencyId);
  if (error) {
    return false;
  }
  const { count, error: countError } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) {
    return false;
  }
  if ((count ?? 0) > 0) {
    return true;
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  return !deleteError;
}

/** Full access (full-access.sql): any of the caller's rows has the mark. */
export function hasFullAccess(rows: readonly Record<string, unknown>[]): boolean {
  return rows.some((row) => row.can_access_all_agencies === true);
}

/** A real agency (not a test) that is not in the trash: what full access opens. */
export function isRealActiveAgency(agency: { personal_user_id?: unknown; archived_at?: unknown } | null): boolean {
  return agency !== null && agency.personal_user_id == null && agency.archived_at == null;
}

/** How many agencies an account is in. */
export async function agencyCount(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { count, error } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return error ? null : count ?? 0;
}
