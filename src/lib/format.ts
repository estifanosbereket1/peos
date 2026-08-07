/** Format an amount in Ethiopian Birr, e.g. 1250 -> "Br 1,250". */
export function formatETB(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(value * 100) / 100;
  return `Br ${new Intl.NumberFormat("en-ET").format(rounded)}`;
}