import { LedgerError } from "../../domain/errors";

const MESSAGES: Record<LedgerError["code"], string> = {
  "unknown-racetrack": "Elegí un hipódromo.",
  "unknown-category": "Elegí una categoría.",
  "negative-amount": "El importe no puede ser negativo.",
  "invalid-amount": "El importe no es válido.",
  "empty-entry": "Cargá un importe.",
  "duplicate-day": "Ese día y ese hipódromo ya están cargados.",
  "invalid-date": "La fecha tiene que ser AAAA-MM-DD.",
  "outside-month": "La fecha no pertenece a agosto 2026.",
};

export function ledgerErrorMessage(error: unknown): string {
  if (error instanceof LedgerError) {
    return MESSAGES[error.code];
  }
  return "No se pudo guardar.";
}
