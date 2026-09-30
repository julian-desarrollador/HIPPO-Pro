export function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeAmount(trimmed);
  if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
}

function normalizeAmount(trimmed: string): string | null {
  if (trimmed.includes(",")) {
    return trimmed.replace(/\./g, "").replace(",", ".");
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return trimmed.replace(/\./g, "");
  }
  if (/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return trimmed;
  }
  return null;
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

export function parseSignedPercentToBasisPoints(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace("%", "");
  if (!trimmed) {
    return null;
  }
  const negative = trimmed.startsWith("-");
  const points = parsePercentToBasisPoints(negative ? trimmed.slice(1) : trimmed);
  if (points === null) {
    return null;
  }
  return negative ? -points : points;
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
  return `${sign}${groupThousands(String(whole))},${String(fraction).padStart(2, "0")}`;
}

export function maskAmountInput(raw: string): string {
  const compact = raw.replace(/\s/g, "").replace(/\$/g, "");
  if (!compact) {
    return "";
  }

  const { integerDigits, fraction } = splitAmountParts(compact);
  if (!integerDigits && fraction === null) {
    return "";
  }

  const grouped = groupThousands(stripLeadingZeros(integerDigits));
  if (fraction === null) {
    return grouped;
  }
  return `${grouped},${fraction}`;
}

export function completeAmountInput(raw: string): string {
  if (!raw.trim()) {
    return "";
  }
  const cents = parseAmountToCents(raw);
  if (cents === null) {
    return raw;
  }
  return formatAmountInput(cents);
}

function splitAmountParts(text: string): { integerDigits: string; fraction: string | null } {
  if (text.includes(",")) {
    const comma = text.indexOf(",");
    return {
      integerDigits: text.slice(0, comma).replace(/\D/g, ""),
      fraction: text.slice(comma + 1).replace(/\D/g, "").slice(0, 2),
    };
  }

  if (/^\d+\.\d{1,2}$/.test(text)) {
    const [left, right] = text.split(".");
    return { integerDigits: left, fraction: right };
  }

  if (text.endsWith(".")) {
    return {
      integerDigits: text.slice(0, -1).replace(/\D/g, ""),
      fraction: "",
    };
  }

  return {
    integerDigits: text.replace(/\D/g, ""),
    fraction: null,
  };
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+(?=\d)/, "");
  return stripped || "0";
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
