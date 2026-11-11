/** The minimum for a new password. Passwords chosen before still sign in. */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * What is wrong with a new password, or null. current, when given, is the
 * password it replaces. Keep the Spanish messages aligned with
 * supabase/functions/signup-lottery/index.ts.
 */
export function newPasswordProblem(password: string, confirmPassword: string, current?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "La contraseña tiene que tener letras y números.";
  }
  if (password !== confirmPassword) {
    return "Las contraseñas no coinciden.";
  }
  if (current !== undefined && password === current) {
    return "La contraseña nueva tiene que ser distinta de la actual.";
  }
  return null;
}
