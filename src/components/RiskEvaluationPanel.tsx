import { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadRiskEvaluation, type RiskEvaluation } from "@/services/riskEvaluationService";
import { evaluationAbsence, selectRiskEvaluationTarget } from "@/lib/riskEvaluationPresentation";
import BearImpactPanel from "@/components/BearImpactPanel";

const number = (v: number | null | undefined, status?: string) => v == null || !Number.isFinite(v)
  ? evaluationAbsence(status) : `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

export function RiskEvaluationSummary({ risk }: { risk: RiskEvaluation }) {
  const assessment = risk.profile_assessment;
  const profile = ({ Conservative: "Konservatif", Moderate: "Moderat", Aggressive: "Agresif" } as Record<string, string>)[risk.profile] ?? risk.profile;
  const metrics = [
    { label: "Penurunan terbesar (MDD)", value: number(risk.drawdown.mdd_pct, risk.drawdown.status),
      note: "Seberapa jauh nilai total portofolio pernah turun dari puncaknya." },
    { label: "Fluktuasi tahunan (volatilitas)", value: number(risk.annualized_volatility_pct, risk.availability?.volatility),
      note: "Seberapa besar naik-turun portofolio. Lebih kecil berarti lebih stabil." },
    { label: "Kerugian hari terburuk (CVaR 95%)", value: number(risk.daily_cvar_95_pct, risk.cvar_status),
      note: "Rata-rata kerugian pada 5% hari terburuk; memerlukan 100 sesi. Nilai negatif berarti masih untung pada kelompok hari itu." },
  ];
  return <div className="space-y-4">
    <h3 className="font-semibold">Risiko yang Anda alami · Profil {profile}</h3>
    <p className="text-sm text-slate-600">{risk.start_date} – {risk.end_date}. Dihitung dari nilai seluruh saham dan kas dalam simulasi, termasuk biaya dan dividen tercatat; setoran tidak dianggap keuntungan.</p>
    <div className="grid gap-3 md:grid-cols-3">{metrics.map(m => <div key={m.label} className="rounded-xl border p-4">
      <p className="text-sm text-slate-600">{m.label}</p><p className="my-2 text-xl font-semibold tabular-nums">{m.value}</p>
      <p className="text-xs text-slate-500">{m.note}</p>
    </div>)}</div>
    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
      <p className="font-semibold">{assessment?.status === "within_limit" ? "Fluktuasi berada dalam batas eksperimen profil"
        : assessment?.status === "above_limit" ? "Fluktuasi melampaui batas eksperimen profil" : "Kesesuaian profil belum dapat dinilai"}</p>
      {assessment?.actual_volatility_pct != null && assessment.limit_volatility_pct != null
        ? <p className="mt-1">Fluktuasi portofolio {number(assessment.actual_volatility_pct)}; batas profil {profile} {number(assessment.limit_volatility_pct)} pada sesi pembanding yang sama.</p>
        : <p className="mt-1">Memerlukan minimal {assessment?.minimum_sessions ?? 63} sesi portofolio dan IHSG yang valid.</p>}
      <p className="mt-1 text-xs">{assessment?.notice ?? "Batas profil masih berupa aturan eksperimen TA, bukan toleransi kerugian pribadi."} MDD dan CVaR bersifat deskriptif; keduanya belum memiliki batas pribadi pengguna.</p>
    </div>
    <p className="text-xs text-slate-500">{risk.simulation_notice ?? "Angka mendeskripsikan simulasi backtest, bukan jaminan risiko di masa depan."}</p>
  </div>;
}

export default function RiskEvaluationPanel({ portfolioId, startDate, endDate, backtest, profile,
  overallPortfolioId, overallStartDate, overallEndDate }: {
  portfolioId: string; startDate: string; endDate: string; backtest: boolean; profile: string;
  overallPortfolioId?: string; overallStartDate?: string; overallEndDate?: string;
}) {
  const overall = overallPortfolioId && overallStartDate && overallEndDate
    ? { portfolioId: overallPortfolioId, startDate: overallStartDate, endDate: overallEndDate } : null;
  const separateOverall = !!overall && (overall.portfolioId !== portfolioId || overall.startDate !== startDate || overall.endDate !== endDate);
  const [scope, setScope] = useState<"period" | "overall">(separateOverall ? "overall" : "period");
  const target = selectRiskEvaluationTarget({ portfolioId, startDate, endDate }, overall, scope);
  if (!backtest) return null;
  return <Card className="shadow-sm">
    <CardHeader><CardTitle>Risiko portofolio Anda</CardTitle>
      <CardDescription>Lihat risiko terhadap profil Anda dan apakah saran bear membantu menguranginya.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      {separateOverall && <label className="block max-w-md text-sm">Periode penilaian risiko portofolio
        <select aria-label="Periode penilaian risiko portofolio" value={scope}
          onChange={e => setScope(e.target.value as "period" | "overall")}
          className="mt-1 block w-full rounded-lg border bg-card p-2">
          <option value="overall">Seluruh rangkaian backtest</option><option value="period">Periode snapshot yang ditampilkan</option>
        </select></label>}
      <p className="text-sm text-slate-600">Portofolio dinilai pada {target.startDate.slice(0, 10)} – {target.endDate.slice(0, 10)}.</p>
      <RiskResults key={`${target.portfolioId}-${target.startDate}-${target.endDate}-${profile}`} {...target} profile={profile} />
    </CardContent>
  </Card>;
}

function RiskResults({ portfolioId, startDate, endDate, profile }: { portfolioId: string; startDate: string; endDate: string; profile: string }) {
  const [risk, setRisk] = useState<RiskEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function calculate() {
    setBusy(true); setError("");
    try { setRisk((await loadRiskEvaluation(portfolioId, startDate, endDate, true, profile)).risk); }
    catch (e) { setError(axios.isAxiosError(e) ? String(e.response?.data?.detail ?? e.message) : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <Button variant="outline" disabled={busy} onClick={calculate}>{busy ? "Menghitung risiko…" : "Lihat risiko sesuai profil"}</Button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {risk && <RiskEvaluationSummary risk={risk} />}
    <BearImpactPanel portfolioId={portfolioId} startDate={startDate} endDate={endDate} profile={profile} />
  </div>;
}
