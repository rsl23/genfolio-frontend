import type { ExplanationMetric, PortfolioData, StockExplanation } from "@/types";

export function formatExplanationMetric(metric: ExplanationMetric): string {
  if (!Number.isFinite(metric.value)) return "—";
  const digits = metric.unit === "ratio" ? 3 : 2;
  const value = metric.unit === "percent" ? metric.value * 100 : metric.value;
  const text = value.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (metric.unit === "percent") return `${text}%`;
  if (metric.unit === "multiple") return `${text}×`;
  if (metric.unit === "percentage_point") return `${text} pp`;
  if (metric.unit === "rupiah") return `Rp${text}`;
  return text;
}

export function explanationBody(text: string): string {
  return text.split(/(?<=[.!?])\s+/).filter(sentence =>
    !/\b(bukan|tidak|belum tentu)\b[^.!?;]{0,55}\b(jaminan|menjamin|prediksi|nasihat keuangan)\b/i.test(sentence)
  ).join(" ").trim();
}

/** Value-specific readings for saved snapshots whose old definitions were static. */
export function stockMetricReading(metric: ExplanationMetric, ticker: string): string {
  const number = formatExplanationMetric(metric);
  if (metric.id === "per") return metric.value > 0
    ? `Harga per lembar ${ticker} setara ${number} laba per lembar saat ini. Rasio ini menghubungkan harga yang dibayar dengan kemampuan perusahaan menghasilkan laba.`
    : `PER ${ticker} tercatat ${number}. Nilai nol atau negatif membuat perbandingan harga terhadap laba positif tidak dapat dibaca dengan cara biasa.`;
  if (metric.id === "roe") return `ROE ${ticker} ${number} menunjukkan besarnya rasio laba terhadap ekuitas pada periode data. Angka ini menjelaskan kemampuan menghasilkan laba relatif terhadap modal pemegang saham.`;
  if (metric.id === "der") {
    if (metric.value === 0) return `DER ${ticker} tercatat nol. Komponen utang yang diukur dalam rasio ini bernilai nol relatif terhadap ekuitas pada data yang digunakan.`;
    if (metric.value < 0) return `DER ${ticker} ${number} bernilai negatif. Komponen utang dan ekuitas perlu dibaca terpisah karena rasionya tidak mengikuti skala perbandingan positif.`;
    const relation = metric.value < 1 ? "lebih kecil" : metric.value === 1 ? "setara" : "lebih besar";
    return `DER ${ticker} ${number} berarti utang yang diukur ${relation} daripada ekuitas. Angka ini memperlihatkan besarnya pendanaan utang dibandingkan modal pemegang saham.`;
  }
  if (metric.id === "dividend_yield") return metric.value > 0
    ? `Dividen historis ${ticker} setara ${number} dari harga acuan. Rasio ini menjelaskan pendapatan dividen di luar perubahan harga saham.`
    : `Dividend yield ${ticker} tercatat ${number}, sehingga tidak ada hasil dividen positif yang tercatat pada rasio ini.`;
  if (metric.id === "pbv") return `Harga ${ticker} setara ${number} nilai buku per lembar. Angka ini menghubungkan harga pasar dengan ekuitas akuntansi perusahaan.`;
  if (metric.id === "eps") return `EPS ${ticker} ${number} menunjukkan ${metric.value > 0 ? "laba" : metric.value < 0 ? "rugi" : "laba bersih nol"} per lembar pada periode data dan menjadi dasar pembacaan PER.`;
  return explanationBody(metric.meaning);
}

function metric(id: string, label: string, value: number | null | undefined,
  unit: ExplanationMetric["unit"], meaning: string): ExplanationMetric[] {
  return typeof value === "number" && Number.isFinite(value) ? [{ id, label, value, unit, meaning }] : [];
}

/** Historical text snapshots remain readable without a new LLM request. */
export function legacyExplanationMetrics(portfolio: PortfolioData): ExplanationMetric[] {
  return [
    ...metric("max_drawdown", "Penurunan terbesar · MDD", portfolio.max_drawdown, "percent",
      "Besarnya penurunan nilai dari puncak ke titik terendah berikutnya dalam periode simulasi."),
    ...metric("correlation", "Keterkaitan gerak · Korelasi absolut", portfolio.avg_correlation, "ratio",
      "Skala 0–1. Mendekati nol berarti hubungan linear historis pergerakan antarsaham lebih lemah."),
    ...metric("sharpe", "Hasil dibandingkan fluktuasi · Sharpe", portfolio.sharpe_ratio, "ratio",
      "Membandingkan selisih hasil terhadap tingkat bebas risiko dengan fluktuasi historis."),
  ];
}

export function legacyStockExplanations(portfolio: PortfolioData): StockExplanation[] {
  // Reporting stores the original loader units: ROE is a fraction in live
  // mode and a percentage in backtest. Yield is a fraction in both modes.
  const backtest = portfolio.status_portofolio?.includes("backtest") ?? false;
  return (portfolio.rebalance_diagnostics?.ga_metrics?.fundamentals ?? []).map(row => {
    const metrics = [
      ...metric("per", "PER · Harga dibandingkan laba", row.per, "multiple",
        "Harga per lembar dibandingkan laba per lembar. Baca bersama pertumbuhan dan perusahaan sejenis. PER nol atau negatif tidak berarti saham murah."),
      ...metric("roe", "ROE · Laba terhadap modal", row.roe == null ? null : row.roe / (backtest ? 100 : 1), "percent",
        "Laba dibandingkan ekuitas perusahaan. Periksa laba dan ekuitas negatif secara terpisah. Ini bukan return yang diterima investor."),
      ...metric("dividend_yield", "Dividend yield · Pendapatan dividen", row.dividend_yield, "percent",
        "Dividen historis dibandingkan harga acuan pada input fundamental. Besarnya pembagian berikutnya dapat berbeda."),
      ...metric("der", "DER · Utang terhadap modal", row.der, "multiple",
        "Utang dibandingkan ekuitas. Porsi utang besar bisa menambah tekanan pembayaran saat usaha melemah. Nilai negatif tidak berarti utang rendah."),
      ...metric("pbv", "PBV · Harga dibandingkan nilai buku", row.pbv, "multiple",
        "Harga dibandingkan nilai buku per lembar. Angka kecil tidak otomatis berarti murah."),
    ].map(metric => ({ ...metric, meaning: stockMetricReading(metric, row.ticker) }));
    return {
      ticker: row.ticker, weight: row.weight, weight_basis: "stock_basket",
      description: "Porsinya membantu membaca pengaruh perubahan harga saham ini terhadap keranjang saham.",
      watchout: "", metrics,
    };
  });
}
