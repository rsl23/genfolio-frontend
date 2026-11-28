import type { PortfolioData } from "@/types";

const numeric = (value: number | null | undefined, digits = 4) =>
  value != null && Number.isFinite(value) ? value.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "—";
const percent = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? `${numeric(value * 100, 2)}%` : "—";
const rupiah = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? `Rp ${numeric(value, 0)}` : "—";

const termLabels: Record<string, string> = {
  sharpe: "Sharpe untuk fitness", risk: "Risiko gabungan", stress_missing: "Ketidaklengkapan bukti stress",
  correlation: "Korelasi", fundamental: "Fundamental", dividend: "Dividen", momentum: "Momentum",
  turnover: "Turnover", rebalance_utility: "Utilitas rebalance", return_nav: "Return NAV", cvar: "CVaR",
  upside: "Potensi kenaikan (upside)", volatility: "Volatilitas adaptif",
};

export default function PortfolioFitnessMetrics({ portfolio: p }: { portfolio: PortfolioData | null }) {
  const ga = p?.rebalance_diagnostics?.ga_metrics;
  const cvar = p?.fitness_diagnostics;
  const turnover = ga?.turnover_rate ?? p?.turnover_rate;
  const active = (key: string) => {
    const weight = ga?.coefficients[key];
    if (weight != null) return Number.isFinite(weight) && weight !== 0;
    // Older snapshots do not record every coefficient.
    if (key === "sharpe") return true;
    if (key === "stress_missing") return ga?.market_stress_coverage != null || !!ga?.market_stress_missing_penalty;
    if (key === "cvar") return p?.fitness_policy === "legacy_cvar_v1" && !!cvar;
    return false;
  };
  const turnoverActive = ga ? ga.is_rebalance && active("turnover")
    : turnover != null && p?.turnover_penalty_beta != null && p.turnover_penalty_beta !== 0;
  const contributions = Object.entries(ga?.contributions ?? {}).filter(([key]) =>
    key === "turnover" ? turnoverActive
      : key === "rebalance_utility" ? ga?.is_rebalance && active(key) : active(key),
  );
  const compositionPolicy = p?.rebalance_diagnostics?.profile_policy;
  const compositionLabel = compositionPolicy === "composition_v2" ? "Komposisi v2"
    : compositionPolicy === "composition_v1" ? "Komposisi v1"
    : compositionPolicy === "legacy" ? "Komposisi lama" : compositionPolicy ?? "Tidak tercatat";
  const fitnessLabel = p?.fitness_policy === "legacy_cvar_v1" ? "Multi-metrik + penalti CVaR"
    : p?.fitness_policy === "legacy" ? "Multi-metrik dasar" : p?.fitness_policy ?? "Tidak tercatat";
  const metrics: Array<[string, string, string]> = [
    ["Dana terpakai", rupiah(p?.total_terpakai), "Nilai alokasi saham pada snapshot ini."],
    ["Sisa budget (cash)", rupiah(p?.sisa_budget), "Dana yang tidak dialokasikan ke saham."],
    ["Fitness score", numeric(p?.fitness_score, 6), `Skor objektif GA, bukan persentase return. Model komposisi: ${compositionLabel}. Rumus fitness dasar: ${fitnessLabel}.`],
    ["Sharpe ratio", numeric(p?.sharpe_ratio), "Sharpe historis portofolio termasuk cash."],
    ["Max drawdown portofolio", percent(p?.max_drawdown), "Penurunan historis terbesar dari puncak; termasuk pengaruh cash."],
    ["Rata-rata korelasi absolut", numeric(p?.avg_correlation), "Rata-rata nilai absolut korelasi antarsaham aktif."],
    ["Skor fundamental", numeric(p?.skor_fundamental), "Skor komposit 0–1 yang dibobot alokasi saham."],
    ["Alokasi modal", p ? (p.allocated_budget_ok ? "Lolos" : "Tidak lolos") : "—", "Kesesuaian alokasi dengan budget; rincian penalti kendala tidak disimpan."],
    ["Saham aktif", p?.n_active != null ? `${p.n_active} saham` : "—", "Jumlah saham yang memiliki lot; bukan nilai penalti diversifikasi."],
  ];
  if (ga) metrics.push(
    ["Sharpe untuk fitness", numeric(ga.score_sharpe), ga.lookthrough_stock_risk ? "Dihitung pada keranjang saham sebelum pengaruh cash." : "Sharpe yang dipakai dalam objektif GA."],
  );
  if (ga && active("risk")) metrics.push(
    ["Risiko gabungan", percent(ga.risk_component), "Komponen risiko sebelum dikalikan bobot penalti risiko."],
    ["MDD untuk fitness", percent(ga.mdd_risk_score), ga.lookthrough_stock_risk ? "MDD keranjang saham sebelum pengaruh cash." : "MDD yang dipakai dalam objektif GA."],
  );
  if (ga && active("risk") && ga.market_stress_risk != null && ga.mdd_residual_weight !== 1) metrics.push(
    ["Market stress", percent(ga.market_stress_risk), ga.market_stress_risk == null ? "Tidak tersedia atau tidak digunakan; GA memakai MDD sebagai pengganti." : `Bobot risiko: MDD ${percent(ga.mdd_residual_weight)}, market stress ${percent(ga.mdd_residual_weight == null ? null : 1 - ga.mdd_residual_weight)}.`],
    ["Cakupan bukti stress", percent(ga.market_stress_coverage), "Cakupan bukti historis yang dipakai model market stress."],
  );
  if (ga && active("stress_missing")) metrics.push(
    ["Penalti bukti stress", numeric(ga.market_stress_missing_penalty, 6), "Pengurang fitness akibat bukti stress yang tidak lengkap."],
  );
  if (ga && active("momentum")) metrics.push(
    ["Momentum", numeric(ga.momentum_score), "Sinyal momentum yang dibobot alokasi."],
  );
  if (ga && active("dividend")) metrics.push(
    ["Skor dividen", numeric(ga.dividend_score), "Sinyal dividend yield yang dibatasi dan dinormalisasi sebelum dibobot alokasi."],
    ["Bonus dividen", numeric(ga.dividend_bonus, 6), "Kontribusi dividen setelah dikalikan bobot bonus."],
  );
  if (ga && (active("upside") || active("return_nav"))) metrics.push(
    ["Return historis tahunan", percent(ga.roi_annual), "Rata-rata return harian × 252; bukan prediksi return."],
  );
  if (turnoverActive) metrics.push(
    ["Turnover GA", percent(turnover), "Rasio turnover yang dievaluasi GA; dapat melebihi 100% dan berbeda dari transaksi yang akhirnya dieksekusi."],
    ["Penalti turnover", numeric(ga?.contributions?.turnover != null ? -ga.contributions.turnover : turnover != null && p?.turnover_penalty_beta != null ? turnover * p.turnover_penalty_beta : null, 6), "Turnover × bobot penalti; dikurangkan dari fitness aditif."],
  );
  if (ga?.is_rebalance && active("rebalance_utility")) metrics.push(
    ["Utilitas rebalance", numeric(ga.rebalance_utility, 6), "Perbaikan sinyal risiko/imbal hasil dari perubahan alokasi, sebelum bobot utilitas."],
  );
  if (ga?.upside_signal != null && active("upside")) metrics.push(
    ["Sinyal upside", numeric(ga.upside_signal), "Return tahunan historis / volatilitas benchmark, dibatasi pada −2 hingga 2."],
  );
  // Composition constraints still use volatility even when its fitness penalty is off.
  if (ga?.volatility_ratio != null) metrics.push(
    ["Volatilitas keranjang saham", percent(ga.stock_volatility), "Volatilitas saham yang digunakan untuk evaluasi komposisi profil."],
    ["Volatilitas benchmark", percent(ga.benchmark_volatility), "Volatilitas benchmark pembanding komposisi."],
    ["Rasio volatilitas", numeric(ga.volatility_ratio), "Volatilitas keranjang saham dibanding benchmark untuk batas komposisi profil."],
  );
  if (p?.transaction_costs != null) metrics.push(["Biaya transaksi eksekusi", rupiah(p.transaction_costs), "Biaya transaksi pada snapshot ini; berbeda dari penalti turnover GA."]);
  if (cvar && active("cvar")) metrics.push(
    ["Skor sebelum penalti CVaR", numeric(cvar.legacy_score, 6), "Skor dasar sebelum penalti kerugian ekor skenario."],
    ["Return bersih skenario", percent(cvar.mean_net_return), "Rata-rata return skenario historis setelah biaya."],
    ["Downside CVaR", percent(cvar.downside_cvar), "Kerugian rata-rata pada ekor skenario. Nilai nol tidak berarti investasi tanpa risiko."],
    ["Penalti CVaR", numeric(cvar.cvar_penalty, 6), `${cvar.scenario_count} skenario historis, masing-masing ${cvar.horizon_days} sesi; bukan prediksi tervalidasi.`],
  );

  return <div className="space-y-4">
    <p className="text-xs leading-relaxed text-slate-500">Metrik pada saat optimasi snapshot ini, bukan evaluasi pasar terkini. Tanda — berarti data tidak tersedia.
      {!ga && " Rincian GA belum tersimpan untuk snapshot lama ini; tersedia pada hasil optimasi baru."}
      {p?.holdings_edited && " Kepemilikan telah diedit; metrik GA tetap mencerminkan hasil optimasi awal."}
      {p?.rebalance_diagnostics?.fitness_excludes_frozen_outside_universe && " Posisi beku di luar kandidat tidak tercakup dalam evaluasi fitness."}
    </p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(([label, value, description]) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-1 text-sm font-medium text-slate-500">{label}</div>
        <div className="break-words text-lg font-bold tabular-nums text-slate-900">{value}</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>)}
    </div>
    {!!contributions.length && <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Bobot dan kontribusi ke fitness</summary>
      <p className="my-3 text-xs text-slate-500">Hanya komponen aktif yang ditampilkan. Kontribusi bertanda + menambah skor; − mengurangi skor. Penalti kendala modal/diversifikasi tidak dirinci di tabel ini.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Komponen</th><th className="text-right">Bobot</th><th className="text-right">Kontribusi</th></tr></thead>
        <tbody>{contributions.map(([key, value]) => <tr key={key} className="border-b last:border-0">
          <td className="py-2 pr-3">{termLabels[key] ?? key}</td><td className="text-right tabular-nums">{numeric(ga?.coefficients[key] ?? (key === "sharpe" ? 1 : null))}</td>
          <td className="pl-3 text-right tabular-nums">{value != null && value > 0 ? "+" : ""}{numeric(value, 6)}</td>
        </tr>)}</tbody>
      </table></div>
    </details>}
    {!!ga?.fundamentals.length && <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Detail fundamental per saham</summary>
      <p className="my-3 text-xs text-slate-500">Input fundamental pada saat optimasi. Skor komposit dinormalisasi relatif terhadap kandidat GA; bobot tabel relatif terhadap alokasi saham. Dividen di tabel ini adalah input fundamental, sedangkan bonus dividen dapat memakai sumber dividend yield terpisah.</p>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-sm">
        <thead><tr className="border-b text-right">{["Saham", "Bobot saham", "Skor (0–1)", "PER", "PBV", "ROE", "DER", "Dividend yield"].map(label => <th key={label} className="px-3 py-2 first:pl-0 first:text-left">{label}</th>)}</tr></thead>
        <tbody>{ga.fundamentals.map(row => <tr key={row.ticker} className="border-b text-right tabular-nums last:border-0">
          <td className="py-2 text-left font-semibold">{row.ticker}</td>
          {[percent(row.weight), numeric(row.score), numeric(row.per, 2), numeric(row.pbv, 2), percent(row.roe), numeric(row.der, 2), percent(row.dividend_yield)].map((value, i) => <td key={i} className="px-3 py-2">{value}</td>)}
        </tr>)}</tbody>
      </table></div>
    </details>}
  </div>;
}
