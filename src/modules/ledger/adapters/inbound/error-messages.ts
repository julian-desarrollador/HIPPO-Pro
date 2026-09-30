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
  "unknown-entry": "Ese movimiento no está.",
  "invalid-percent": "El porcentaje tiene que estar entre 0 y 100.",
  "save-failed": "No se pudo guardar. Revisá la conexión.",
  "save-conflict": "Alguien guardó este libro antes. Volvé a intentar.",
  "invalid-name": "Escribí el nombre.",
  "duplicate-racetrack": "Ya hay un hipódromo con ese nombre.",
  "builtin-racetrack": "San Isidro, Palermo y La Plata no se pueden cambiar.",
  "racetrack-in-use": "Este hipódromo ya tiene días o depósitos. Quitá esos movimientos antes.",
  "invalid-adjustment": "El ajuste tiene que estar entre -100 y 100.",
  "duplicate-category": "Ya hay una categoría con ese nombre.",
  "builtin-category": "Las categorías de agosto no se pueden cambiar.",
  "category-in-use": "Esta categoría ya tiene gastos. Quitá esos movimientos antes.",
  "duplicate-bettor": "Ya hay un apostador con ese nombre.",
  "unknown-bettor": "Ese apostador no está.",
  "bettor-in-use": "Este apostador ya tiene días o pagos. Quitá esos movimientos antes.",
};

export function ledgerErrorMessage(error: unknown): string {
  if (error instanceof LedgerError) {
    return MESSAGES[error.code];
  }
  return "No se pudo guardar.";
}
