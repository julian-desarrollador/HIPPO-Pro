export type Cents = number;

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function applyBasisPoints(amountCents: Cents, basisPoints: number): Cents {
  const product = amountCents * basisPoints;
  const sign = product < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(product) / 10_000);
}

export function formatCents(cents: Cents): string {
  return currency.format(cents / 100);
}

export function formatSignedPercent(basisPoints: number): string {
  const percent = basisPoints / 100;
  const amount = String(Math.abs(percent));
  if (basisPoints < 0) {
    return `−${amount} %`;
  }
  if (basisPoints > 0 && basisPoints < 500) {
    return `+${amount} %`;
  }
  if (basisPoints > 0) {
    return `${amount} %`;
  }
  return "0 %";
}
