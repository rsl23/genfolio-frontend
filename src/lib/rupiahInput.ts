/** Format nominal ketika diketik: titik ribuan, koma desimal (maksimal 2 digit). */
export function formatRupiahInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  if (!cleaned) return "";

  const comma = cleaned.indexOf(",");
  const integer = (comma < 0 ? cleaned : cleaned.slice(0, comma))
    .replace(/^0+(?=\d)/, "") || "0";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (comma < 0) return grouped;
  return `${grouped},${cleaned.slice(comma + 1).replace(/,/g, "").slice(0, 2)}`;
}

/** Konversi tampilan id-ID ke angka untuk payload API. */
export function parseRupiahInput(value: string): number {
  if (!value) return 0;
  return Number(value.replace(/\./g, "").replace(",", "."));
}
