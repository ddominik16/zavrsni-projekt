// Hrvatski format brojeva: tocka za tisucice, zarez za decimale.

export function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("hr-HR");
}

export function formatDecimal(n, places = 4) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(places).replace(".", ",");
}

export function formatRating(n) {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1).replace(".", ",");
}
