export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCostRange(min: number, max: number): string {
  if (min === max) return formatUSD(min);
  return `${formatUSD(min)} – ${formatUSD(max)}`;
}
