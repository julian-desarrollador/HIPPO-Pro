const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
