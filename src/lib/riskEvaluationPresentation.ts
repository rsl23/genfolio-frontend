/** Human-readable absence reasons; a missing denominator is not a zero score. */
export interface RiskEvaluationTarget { portfolioId: string; startDate: string; endDate: string }

/** Keep the identity and date bounds from the same selected scope. */
export function selectRiskEvaluationTarget(period: RiskEvaluationTarget, overall: RiskEvaluationTarget | null,
  scope: "period" | "overall") {
  return scope === "overall" && overall ? overall : period;
}

export function evaluationAbsence(status: string | undefined, fallback = "Belum dapat dinilai") {
  const labels: Record<string, string> = {
    pending_review: "Evaluasi ditunda",
    insufficient_history: "Periode terlalu pendek",
    insufficient_tail_history: "Riwayat ekor risiko belum cukup",
    unverified_nav: "Riwayat NAV belum dapat dinilai",
    insufficient_pairs: "Sesi perbandingan belum cukup",
    insufficient_directional_sessions: "Sesi arah pasar belum cukup",
    incomplete_window: "Jendela data belum lengkap",
    incomplete_nav: "Riwayat nilai belum lengkap",
    benchmark_constant: "Pergerakan IHSG terlalu kecil",
    benchmark_unavailable: "Data IHSG belum tersedia",
    invalid_returns: "Return belum dapat dinilai",
    no_alerts: "Belum ada alert",
    incomplete_alerts: "Belum ada alert lengkap",
    no_complete_reference_episodes: "Belum ada episode lengkap",
    no_detected_episodes: "Belum ada episode terdeteksi",
    recovery_not_observed: "Pemulihan belum teramati",
  };
  return status ? (labels[status] ?? fallback) : fallback;
}
