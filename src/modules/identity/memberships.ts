import type { ViewerRole } from "../ledger/domain/types";

/** One agency an account is in: one profiles row (multi-agency.sql). */
export type Membership = {
  agencyId: string;
  role: ViewerRole;
  displayName: string;
  canInviteOwners: boolean;
  canCreateAgencies: boolean;
  canManageTrash: boolean;
};

function isViewerRole(value: unknown): value is ViewerRole {
  return value === "owner" || value === "operator";
}

/** Reads the caller's profiles rows. Bad rows are skipped; a repeated agency counts once. */
export function membershipsFrom(rows: unknown): Membership[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const seen = new Set<string>();
  return rows.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const row = value as Record<string, unknown>;
    if (typeof row.agency_id !== "string" || !row.agency_id || !isViewerRole(row.role) || seen.has(row.agency_id)) {
      return [];
    }
    seen.add(row.agency_id);
    return [
      {
        agencyId: row.agency_id,
        role: row.role,
        displayName: typeof row.display_name === "string" ? row.display_name : "",
        canInviteOwners: row.can_invite_owners === true,
        canCreateAgencies: row.can_create_agencies === true,
        canManageTrash: row.can_manage_trash === true,
      },
    ];
  });
}

/** The agency to open: the one used last, if the account is still in it; else the first. */
export function pickAgency<T extends { agencyId: string }>(agencies: readonly T[], remembered: string | null): T | null {
  return agencies.find((agency) => agency.agencyId === remembered) ?? agencies[0] ?? null;
}

/** The marks that belong to the person, not to one agency: any row that has them counts. */
export function personMarks(memberships: readonly Membership[]): { canCreateAgencies: boolean; canManageTrash: boolean } {
  return {
    canCreateAgencies: memberships.some((membership) => membership.canCreateAgencies),
    canManageTrash: memberships.some((membership) => membership.canManageTrash),
  };
}

/**
 * What to tell after adding someone, from the function's answer. Null for a new
 * account: the invitation went out, and each screen already says so.
 */
export function joinNotice(data: unknown, email: string): string | null {
  const answer = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (answer.outcome !== "existing") {
    return null;
  }
  const who = email.trim().toLowerCase();
  if (answer.passwordLinkSent === true) {
    return `${who} ya tenía cuenta, pero todavía no eligió su contraseña. Le reenviamos el correo para elegirla.`;
  }
  return `${who} ya tenía cuenta. Entra con su contraseña de siempre y elige esta agencia en Tus agencias.`;
}

/** Where this browser remembers the last agency of an account. */
export function rememberedAgencyKey(userId: string): string {
  return `hippo-pro.agency.${userId}`;
}
