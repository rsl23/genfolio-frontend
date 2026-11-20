import apiClient from "./apiClient";
export type BearEvaluationScope = "portfolio" | "market_history";

export interface RiskDrawdown {
  mdd_pct: number | null; max_underwater_sessions: number | null;
  current_underwater_sessions: number | null; worst_recovery_sessions: number | null;
  worst_trough_date: string | null; recovered: boolean | null; status?: string;
}

export interface RiskEvaluation {
  profile_assessment?: { status: "within_limit" | "above_limit" | "insufficient_data";
    actual_volatility_pct: number | null; limit_volatility_pct: number | null;
    sessions: number; minimum_sessions: number; notice: string };
  version: string; start_date: string | null; end_date: string | null; profile: string;
  portfolio_status?: "available" | "pending_review" | "simulation_estimate";
  simulation_notice?: string;
  estimated_valuation_sessions?: number;
  downside_deviation_pct?: number | null;
  daily_cvar_95_pct?: number | null;
  cvar_status?: string;
  cvar_min_sessions?: number;
  comparison_portfolio_volatility_pct?: number | null;
  metric_eligibility?: Record<string, "eligible" | "excluded_corporate_action" | "unverified_nav">;
  availability?: { volatility: string; relative_volatility?: string; compliance: string; latest_window: string };
  notes?: string[];
  nav_return_sessions?: number;
  profile_cap: number; window_sessions: number; minimum_capture_sessions: number;
  observations: number; paired_sessions: number; coverage_pct: number | null;
  annualized_volatility_pct: number | null; ihsg_annualized_volatility_pct: number | null;
  relative_volatility: number | null; stock_basket_relative_volatility: number | null;
  latest_rolling_relative_volatility: number | null;
  compliance_pct: number | null; valid_windows: number; eligible_windows: number;
  latest_status: "within_limit" | "above_limit" | "insufficient_data";
  downside_capture: { pct: number | null; sessions: number; status?: string };
  upside_capture: { pct: number | null; sessions: number; status?: string };
  drawdown: RiskDrawdown;
  warnings: string[];
}
export interface BearEvaluation {
  status: "available" | "unavailable"; reason?: string;
  scope?: BearEvaluationScope;
  metric_status?: Record<string, string>;
  archive_start?: string; archive_end?: string; detector_version?: string;
  start_date?: string | null; end_date?: string | null;
  sessions?: number; scored_sessions?: number; censored_sessions?: number; signal_missing_sessions?: number;
  episode_count?: number; evaluable_alerts?: number; excluded_alerts?: number;
  alert_precision_pct?: number | null; episode_recall_pct?: number | null;
  false_alerts_per_year?: number | null; median_onset_lag_sessions?: number | null;
  median_recovery_lag_sessions?: number | null;
  episodes?: { start: string; end: string; confirmed_on: string; detected: boolean;
    onset_lag_sessions: number | null; recovery_lag_sessions: number | null }[];
  warnings?: string[];
}
export async function loadRiskEvaluation(id: string, start: string, end: string, backtest: boolean, profile: string,
  bearScope: BearEvaluationScope = "market_history", includeBear = false) {
  const response = await apiClient.get<{ data: { risk: RiskEvaluation; bear: BearEvaluation | null } }>(
    `/api/v1/portfolios/evaluation/${encodeURIComponent(id)}`,
    { params: { start_date: start.slice(0, 10), end_date: end.slice(0, 10), backtest,
      comparison_profile: profile, include_bear: includeBear, bear_scope: bearScope } },
  );
  return response.data.data;
}

export interface BearImpactArm {
  risk: RiskEvaluation; net_return_pct: number; final_nav: number;
  transaction_costs: number; average_equity_pct: number;
}
export type BearImpactResult = { status: "unavailable"; reason: string } | {
  status: "available"; start_date: string; end_date: string; verdict: string;
  recommended: BearImpactArm; full: BearImpactArm; bear_decisions: number;
  differences: { mdd_reduction_pp: number | null; volatility_reduction_pp: number | null;
    cvar_reduction_pp: number | null; return_difference_pp: number };
  assumptions: string[];
  decisions: { date: string; signal_date: string; status: string; fraction: number }[];
};
export async function loadBearImpact(id: string, start: string, end: string, profile: string) {
  const response = await apiClient.post<{ data: BearImpactResult }>(
    `/api/v1/portfolios/bear-impact/${encodeURIComponent(id)}`,
    { start_date: start.slice(0, 10), end_date: end.slice(0, 10), risk_profile: profile });
  return response.data.data;
}
