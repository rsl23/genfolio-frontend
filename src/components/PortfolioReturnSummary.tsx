import type { PortfolioReturnMetrics } from "@/types";

const percent = (value: number | null) => value === null ? "—"
  : `${value > 0 ? "+" : ""}${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const tone = (value: number | null) => value === null ? "text-slate-400"
  : value < 0 ? "text-red-600" : "text-emerald-700";

export default function PortfolioReturnSummary({ metrics }: { metrics: PortfolioReturnMetrics | null }) {
  const shortPeriod = metrics != null && metrics.performance_days < 365;
  const items = [
    {
      label: "TWR · Kinerja portofolio",
      value: metrics?.twr_return_pct ?? null,
      description: "Return periode tanpa pengaruh besar setoran.",
      detail: "Memudahkan perbandingan dengan IHSG.",
    },
    {
      label: "MWR · Hasil dana Anda",
      value: metrics?.money_weighted_return_pct ?? null,
      description: "Return periode dengan bobot jumlah dan waktu setoran.",
      detail: metrics?.money_weighted_return_annualized_pct != null
        ? `XIRR ${percent(metrics.money_weighted_return_annualized_pct)} per tahun`
        : shortPeriod ? "XIRR tahunan tersedia mulai 365 hari."
          : "XIRR tahunan belum dapat dihitung.",
    },
    {
      label: "Annualized · TWR per tahun",
      value: metrics?.annualized_twr_return_pct ?? null,
      description: "Rata-rata pertumbuhan majemuk tahunan.",
      detail: shortPeriod ? `Periode baru ${metrics.performance_days} hari; minimal 365 hari.`
        : metrics?.annualized_twr_return_pct != null ? "Berdasarkan TWR, bukan prediksi return."
          : "Menunggu data TWR yang dapat dihitung.",
    },
  ];
  return (
    <section aria-label="Jenis return portofolio" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-0 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 p-5">
            <h3 className="text-xs font-medium text-slate-600">{item.label}</h3>
            <p className={`mt-2 break-words text-2xl font-semibold tabular-nums ${tone(item.value)}`}>
              {percent(item.value)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
      <details className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">Cara membaca angka return</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>Return atas dana masuk = keuntungan rupiah ÷ (modal awal + setoran). Angka ini tidak memperhitungkan kapan dana masuk, sehingga berbeda dari MWR.</p>
          <p>MWR dihitung dengan XIRR lalu dikonversi ke panjang periode yang dipilih. XIRR tahunan dan TWR tahunan memakai 365 hari per tahun dan ditampilkan setelah tersedia minimal satu tahun riwayat.</p>
          <p>Keuntungan rupiah memakai nilai portofolio, termasuk saham yang belum dijual dan piutang dividen; bukan jumlah kas yang sudah diterima. Setoran live yang menunggu rebalance belum dihitung.</p>
        </div>
      </details>
    </section>
  );
}
