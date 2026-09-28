export function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
}

export function readAmount(raw: string, allowEmpty: boolean): number | null {
  if (!raw.trim()) {
    return allowEmpty ? 0 : null;
  }
  return parseAmountToCents(raw);
}
