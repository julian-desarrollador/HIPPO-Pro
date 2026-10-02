const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteRole = "operator" | "owner";

export function inviteOperatorProblem(displayName: string, email: string): string | null {
  if (!displayName.trim()) {
    return "Escribí el nombre.";
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return "Escribí el correo.";
  }
  if (!emailPattern.test(cleanEmail)) {
    return "El correo no es válido.";
  }
  return null;
}

export function inviteMemberProblem(
  displayName: string,
  email: string,
  role: InviteRole,
  callerCanInviteOwners: boolean,
): string | null {
  const problem = inviteOperatorProblem(displayName, email);
  if (problem) {
    return problem;
  }
  if (role === "owner" && !callerCanInviteOwners) {
    return "Solo un dueño habilitado puede invitar dueños.";
  }
  return null;
}
