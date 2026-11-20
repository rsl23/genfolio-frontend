import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { loadBearImpact, type BearImpactResult, type BearImpactArm } from "@/services/riskEvaluationService";

const fmt = (v: number | null | undefined, suffix = "%") => v == null || !Number.isFinite(v)
  ? "Belum cukup data" : `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${suffix}`;

export function BearImpactSummary({ result }: { result: BearImpactResult }) {
  if (result.status === "unavailable") return <p className="text-sm text-amber-800">Perbandingan belum tersedia: {result.reason}</p>;
  const metrics: [string, (arm: BearImpactArm) => string][] = [
    ["Penurunan maksimum (MDD)", a => fmt(a.risk.drawdown.mdd_pct)],
    ["Volatilitas tahunan", a => fmt(a.risk.annualized_volatility_pct)],
    ["CVaR harian 95%", a => fmt(a.risk.daily_cvar_95_pct)],
  ];
  return <div className="space-y-3 text-sm">
    <p>{result.start_date} – {result.end_date} · {result.bear_decisions} keputusan mengurangi porsi saham karena bear.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b"><th className="p-2">Ukuran portofolio total</th><th className="p-2">Ikuti saran bear</th><th className="p-2">100% dana investasi ke saham</th></tr></thead>
      <tbody>{metrics.map(([label, value]) => <tr className="border-b" key={label}><td className="p-2">{label}</td>
        <td className="p-2 tabular-nums">{value(result.recommended)}</td><td className="p-2 tabular-nums">{value(result.full)}</td></tr>)}</tbody>
    </table></div>
    <p className="rounded-lg bg-slate-50 p-3">{result.verdict === "no_bear_reduction"
      ? "Tidak ada pengurangan alokasi bear pada tanggal keputusan dalam periode ini; kedua skenario sama."
      : result.verdict === "recommended_lower_risk" ? "Saran bear menurunkan setidaknya satu ukuran MDD, volatilitas atau CVaR yang tersedia, tanpa memperburuk ukuran lainnya."
      : result.verdict === "full_lower_risk" ? "Skenario 100% saham memiliki ukuran risiko yang lebih rendah pada perbandingan ini."
      : "Hasil risiko bercampur atau hampir sama; saran bear belum memberikan perlindungan yang merata."}
    </p>
    <p className="text-xs text-slate-500">Lebih kecil berarti risiko lebih rendah. CVaR memerlukan 100 sesi; nilai negatif berarti kelompok hari terburuk masih untung.
      Hasil adalah simulasi alokasi pada saham yang sama, bukan jaminan perlindungan di masa depan.</p>
  </div>;
}

export default function BearImpactPanel({ portfolioId, startDate, endDate, profile }: {
  portfolioId: string; startDate: string; endDate: string; profile: string;
}) {
  const [result, setResult] = useState<BearImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function calculate() {
    setBusy(true); setError("");
    try { setResult(await loadBearImpact(portfolioId, startDate, endDate, profile)); }
    catch (e) { setError(axios.isAxiosError(e) ? String(e.response?.data?.detail ?? e.message) : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t pt-5">
    <h3 className="font-semibold">Pengaruh saran bear terhadap risiko pengguna</h3>
    <p className="text-sm text-slate-600">Apakah mengikuti saran porsi saham/kas mengurangi risiko Anda dibanding memakai 100% dana investasi ke saham?
      Saham, modal dan periode dibuat sama. Simulasi mengikuti jadwal rebalance tersimpan tanpa pembulatan lot.</p>
    <Button variant="outline" disabled={busy} onClick={calculate}>{busy ? "Membandingkan alokasi…" : "Bandingkan saran bear vs 100% saham"}</Button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {result && <BearImpactSummary result={result} />}
  </section>;
}
