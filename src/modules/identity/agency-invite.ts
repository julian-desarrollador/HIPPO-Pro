import { inviteOperatorProblem } from "./operator-invite";

export const agencyNameMaxLength = 80;

/** Keep aligned with agencyIdFromName in supabase/functions/create-agency/index.ts. */
export function agencyIdFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/** Keep the Spanish messages aligned with supabase/functions/create-agency/index.ts. */
export function personalAgencyNameProblem(agencyName: string): string | null {
  const name = agencyName.trim();
  if (!name) {
    return "Escribí el nombre de la agencia.";
  }
  if (name.length > agencyNameMaxLength) {
    return "El nombre de la agencia es muy largo.";
  }
  if (!agencyIdFromName(name)) {
    return "El nombre de la agencia necesita letras o números.";
  }
  return null;
}

export function newAgencyProblem(agencyName: string, ownerName: string, ownerEmail: string): string | null {
  const nameProblem = personalAgencyNameProblem(agencyName);
  if (nameProblem) {
    return nameProblem;
  }
  if (!ownerName.trim()) {
    return "Escribí el nombre del dueño.";
  }
  return inviteOperatorProblem(ownerName, ownerEmail);
}

export function lotterySignupProblem(
  agencyName: string,
  ownerName: string,
  ownerEmail: string,
  password: string,
): string | null {
  const problem = newAgencyProblem(agencyName, ownerName, ownerEmail);
  if (problem) {
    return problem;
  }
  if (password.length < 6) {
    return "La contraseña tiene que tener al menos 6 caracteres.";
  }
  return null;
}
