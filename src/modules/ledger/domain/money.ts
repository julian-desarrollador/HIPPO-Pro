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
