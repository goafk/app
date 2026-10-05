// Money as agents report it: "$0.42", "$12.3", "$120".
export function money(n: number | undefined, currency = "USD"): string {
  const v = n ?? 0;
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return sym ? `${sym}${s}` : `${s} ${currency}`;
}
