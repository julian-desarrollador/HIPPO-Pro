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

export function parsePercentToBasisPoints(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace("%", "");
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const basisPoints = Math.round(Number(normalized) * 100);
  if (basisPoints > 10_000) {
    return null;
  }
  return basisPoints;
}

export function formatPercentInput(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = Math.abs(basisPoints % 100);
  if (fraction === 0) {
    return String(whole);
  }
  return `${whole},${String(fraction).padStart(2, "0")}`;
}

export function formatAmountInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const fraction = abs % 100;
  return `${sign}${whole},${String(fraction).padStart(2, "0")}`;
}
