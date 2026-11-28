export type RiskProfile = "Konservatif" | "Moderat" | "Agresif" | null;

/**
 * Mode tampilan/eksekusi rekomendasi:
 * - "live"     : portofolio real (status backend "active"), data pasar hari ini.
 * - "backtest" : simulasi historis (status backend "active_backtest").
 */
export type PortfolioMode = "live" | "backtest";
export type FitnessPolicy = "legacy" | "legacy_cvar_v1";

export interface FitnessExperimentOptions {
  profile_policy?: "legacy" | "composition_v2";
  fitness_policy?: FitnessPolicy;
  charge_transaction_fees?: boolean;
  fitness_horizon_days?: number;
  fitness_cvar_tail_fraction?: number;
  fitness_lambda_cvar?: number;
  rebalance_buy_fee_rate?: number;
  rebalance_sell_fee_rate?: number;
}

export type BearChoice = "recommended" | "full";

export interface BearMarketAssessment {
  status: "bear" | "normal" | "unknown";
  severity: number | null;
  as_of: string | null;
  requested_date: string;
  decision_date: string;
  execution_date: string | null;
  scheduled_date?: string;
  recommended_fraction: number | null;
  risk_profile: string;
  reason: string;
  config_version: string;
  allocation_config_version: string;
  allocation_formula: string;
  fingerprint: string;
  components: Record<string, number>;
  effective_weights: Record<string, number>;
  missing_indicators: string[];
  breadth_details?: {
    status: "available" | "unavailable";
    as_of: string | null;
    universe_count: number;
    eligible_count: number;
    coverage: number;
    fraction_below_ma: number | null;
    ma_sessions: number;
    reason: string | null;
  } | null;
  formula: string | null;
}

/** Body request POST /api/v1/portfolios/generate */
export interface GeneratePortofolioRequest extends FitnessExperimentOptions {
  rebalance_model?: "legacy" | "guarded_v1";
  budget: number; // total modal (IDR)
  name_portofolio?: string;
  description?: string | null;
  risk_profile: RiskProfile | string;
  /** Jawaban kuesioner (dikirim apa adanya; backend mengabaikannya). */
  answers?: Record<string, { value: string; score?: number }>;
  /** true = GA memakai data historis lokal (bukan data pasar hari ini). */
  backtest: boolean;
  /** Tanggal acuan simulasi "YYYY-MM-DD" — WAJIB bila backtest = true. */
  date_ref?: string;
  rebalance?: boolean;
  generate_llm_narrative?: boolean;
  rebalance_portfolio_id?: string;
  bear_management?: boolean;
  bear_choice?: BearChoice;
  bear_preview_as_of?: string | null;
  bear_preview_fingerprint?: string;
}

/** Body POST /api/v1/portfolios/generate-rebalance-series. */
export interface RebalanceSeriesGenerateRequest extends FitnessExperimentOptions {
  rebalance_model?: "legacy" | "guarded_v1";
  generate_llm_narrative?: boolean;
  base_portfolio_id: string;
  budget: number;
  name_portofolio?: string;
  description?: string | null;
  risk_profile: RiskProfile | string;
  /** Tanggal snapshot tersimpan yang dilanjutkan, format YYYY-MM-DD. */
  start_date: string;
  /** Batas akhir simulasi, format YYYY-MM-DD dan inklusif. */
  end_date: string;
  /** Rebalance dilakukan setiap X bulan; backend menerima 1 sampai 12. */
  interval_months: number;
  contribution_amount?: number;
  contribution_interval_months?: number;
  bear_management?: boolean;
  bear_choices?: Record<string, BearChoice>;
  bear_preview_dates?: Record<string, string>;
  bear_preview_fingerprints?: Record<string, string>;
}

export interface FormData extends Record<string, string> {
  capital: string;
}

export interface PortfolioNewsContextData {
  status: "available" | "unavailable" | "disabled";
  cutoff: string | null;
  lookback_days: number;
  reason: string;
  coverage: string;
  retrieval_partial?: boolean;
  items: Array<{
    id: string;
    ticker: string;
    title: string;
    source: string;
    url: string;
    published_at: string;
    summary: string;
    evidence_level: "headline" | "excerpt";
  }>;
}

export interface GAFitnessMetrics {
  fitness_mode: string;
  is_rebalance: boolean;
  lookthrough_stock_risk: boolean;
  mdd_residual_weight: number | null;
  score_sharpe: number | null;
  mdd_risk_score: number | null;
  risk_component: number | null;
  market_stress_risk: number | null;
  market_stress_coverage: number | null;
  market_stress_missing_penalty: number | null;
  momentum_score: number | null;
  dividend_score: number | null;
  dividend_bonus: number | null;
  rebalance_utility: number | null;
  turnover_rate: number | null;
  roi_annual: number | null;
  upside_signal?: number | null;
  volatility_ratio?: number | null;
  stock_volatility?: number | null;
  benchmark_volatility?: number | null;
  coefficients: Record<string, number | null>;
  contributions?: Record<string, number | null>;
  fundamentals: Array<{
    ticker: string; weight: number | null; score: number | null;
    per: number | null; pbv: number | null; roe: number | null;
    der: number | null; dividend_yield: number | null;
  }>;
}

export interface ExplanationMetric {
  id: string;
  label: string;
  value: number;
  unit: "percent" | "ratio" | "multiple" | "rupiah" | "percentage_point";
  meaning: string;
}

export interface StockExplanation {
  ticker: string;
  weight: number | null;
  weight_basis?: "capital" | "stock_basket";
  description: string;
  watchout: string;
  metrics: ExplanationMetric[];
}

export interface PortfolioExplanationData {
  version: "portfolio_explanation_v1" | "portfolio_explanation_v2";
  summary: string;
  reasons: Array<{ topic?: string; title: string; explanation: string; metric_ids: string[] }>;
  risks: string[];
  limitations: string[];
  portfolio_metrics: ExplanationMetric[];
  stocks: StockExplanation[];
  conclusion: string;
  disclaimer: string;
  period?: { mulai: string | null; akhir: string | null } | null;
  as_of?: string | null;
  basis?: string | null;
}

export interface PortfolioData {
  price_date?: string | null;
  holdings_edited?: boolean;
  execution_prices?: Record<string, number> | null;
  is_list_active?: boolean | null;
  fitness_policy?: string; // Historical snapshots retain the original policy label.
  fitness_diagnostics?: {
    legacy_score?: number;
    mean_net_return: number;
    downside_cvar: number;
    horizon_days: number;
    scenario_count: number;
    cvar_penalty: number;
  } | null;
  transaction_costs?: number;
  turnover_rate?: number | null;
  turnover_penalty_beta?: number | null;
  rebalance_diagnostics?: {
    explanation?: PortfolioExplanationData;
    ga_metrics?: GAFitnessMetrics;
    profile_policy?: string;
    fitness_excludes_frozen_outside_universe?: boolean;
    deferred_fill?: boolean;
    execution_delta_lots?: Record<string, number>;
    model?: string;
    narrative_source?: "openai" | "groq" | "verified_template" | "ga_template";
    narrative_requested?: boolean;
    news_context?: PortfolioNewsContextData;
    reason?: "hold" | "risk_repair" | "net_utility_gain";
    execution_transaction_costs?: number;
  } | null;
  id: string;
  parent_portofolio_id?: string | null;
  execution_date?: string | null;
  name_portofolio?: string | null;
  description?: string | null;
  user_id: string;
  fitness_score: number;
  sharpe_ratio: number;
  // Backend mengirim null (nilai ini hanya dihitung saat generate, tidak
  // disimpan di DB) — null-safe di seluruh pemakaian UI.
  expected_return: number | null;
  max_drawdown: number;
  avg_correlation: number;
  skor_fundamental: number;
  total_terpakai: number;
  sisa_budget: number;
  n_active: number;
  allocated_budget_ok: boolean;
  risk_profile: string;
  status_portofolio: string;
  created_at: string;
  date_ref: string;
  budget: number;
  pending_deposit?: number;
  capital_contribution?: number;
  allocations: Array<PortofolioItem>;
  narasi_llm: string | null;
  /**
   * Daftar perubahan posisi hasil rebalance (field baru backend).
   * Hanya ada bila portofolio dibuat dengan `rebalance = true`.
   * Berisi aksi BUY / SELL / HOLD per kode emiten beserta selisih lotnya.
   */
  rebalance_deltas?: RebalanceDelta[];
  deferred_signals?: DeferredRebalanceSignal[];
}

export interface DeferredRebalanceSignal {
  ticker: string;
  action: "BUY" | "SELL";
  held_lots: number;
  target_lots: number;
  reason: string;
}

/** Satu baris perubahan posisi pada rebalance (field `rebalance_deltas`) */
export interface RebalanceDelta {
  kode: string;
  action: "BUY" | "SELL" | "HOLD";
  old_lot: number;
  new_lot: number;
  /** Selisih lot (old_lot - new_lot); positif = penjualan bersih. */
  delta_lot: number;
  reason: string;
}

/** Satu tanggal rebalance yang tidak dapat diproses backend. */
export interface SkippedRebalanceStep {
  date: string;
  reason: string;
}

/** Respons data POST /generate-rebalance-series. */
export interface RebalanceSeriesResult {
  start_date: string;
  end_date: string;
  interval_months: number;
  scheduled_dates: string[];
  portfolios: PortfolioData[];
  skipped: SkippedRebalanceStep[];
  evaluation_mode?: "automatic_strategy" | "what_if" | "legacy";
}

export interface PortofolioItem {
  item_id?: string; // id item di DB (untuk PATCH harga beli)
  ticker: string;
  lots: number;
  price_per_lot: number; // per lot (harga_acuan x 100)
  harga_beli?: number | null; // average beli per lembar; null jika riwayat tidak cukup
  allocation: number;
  weight: number;
}

export interface FilteredStock {
  Kode: string;
  Tanggal: Date;
  Close: number;
  ListedShares: number;
  Volume_Hari_Ini: number;
  Value_Hari_Ini: number;
  High: number;
  Low: number;
  Frequency: number;
  ForeignBuy: number;
  ForeignSell: number;
}

export interface HistoricalData {
  year: string;
  portfolio: number;
  ihsg: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface ProfileOutletContext {
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: boolean;
  retryProfile: () => void;
}

export interface ApiResponse<T> {
  status: "success" | "error";
  message: string;
  data: T;
}

export interface DeletePortfolioResult {
  deleted_portfolio_ids: string[];
  deleted_portfolios: number;
  deleted_items: number;
  active_portfolio_id: string | null;
}

/** Satu baris harga historis untuk saham individual */
export interface StockPrice {
  date: string; // format "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
}

/** Satu baris harga historis untuk benchmark/index (tanpa volume & adj_close) */
export interface BenchmarkPrice {
  date: string; // format "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Harga historis satu saham (sekumpulan baris harga) */
export interface StockHistory {
  ticker: string;
  stock_id: string;
  prices: StockPrice[];
}

/** Harga historis benchmark/index (mis. ^JKSE / IHSG) */
export interface BenchmarkHistory {
  ticker: string;
  prices: BenchmarkPrice[];
}

/** Payload `data` dari response endpoint market-data */
export interface MarketData {
  start_date: string; // format "YYYY-MM-DD"
  end_date: string; // format "YYYY-MM-DD"
  stocks: StockHistory[];
  benchmark: BenchmarkHistory[];
}

export interface PerformancePoint {
  date: string; // "2026-09-04"; mode backtest bisa "2024-06-28T00:00:00" (datetime)
  /** NAV harian = nilai saham + kas, dalam Rupiah. */
  portfolio_value: number | null;
  /** Kas tersisa setelah snapshot/rebalance pada hari tersebut, dalam Rupiah. */
  cash_balance: number | null;
  /** Nilai pasar seluruh saham yang masih dipegang, dalam Rupiah. */
  holdings_market_value: number | null;
  /** Return hari itu sebagai desimal; null pada titik pertama. */
  daily_return: number | null;
  /** Return kumulatif berbobot waktu; setoran eksternal dikeluarkan dari return harian. */
  portfolio_return: number | null;
  capital_contribution?: number;
  total_contributions?: number;
  /** Akumulasi P/L terealisasi dari penjualan/rebalance. */
  realized_pnl_cumulative: number | null;
  /** P/L belum terealisasi pada saham yang masih dipegang. */
  unrealized_pnl: number | null;
  ihsg_return: number | null; // return kumulatif IHSG, desimal; null jika belum tersinkron
  portfolio_value_excluding_dividends?: number | null;
  stale_price_tickers?: string[];
  ihsg_observed?: boolean;
  ihsg_previous_observed_date?: string | null;
  is_market_session?: boolean | null;
  previous_market_session_date?: string | null;
}

/** Payload request untuk PATCH .../items/{item_id}/harga-beli */
export interface UpdateHargaBeliRequest {
  harga_beli: number; // harga beli per lembar, dalam IDR
}

/** Isi `data` dari response PATCH .../items/{item_id}/harga-beli */
export interface HargaBeliUpdateResult {
  item_id: string;
  ticker: string | null;
  jumlah_lot: number;
  harga_acuan: number; // per lembar (harga pasar saat pembelian)
  harga_beli: number; // per lembar (hasil edit)
  total_investasi: number; // jumlah_lot x 100 lembar x harga_beli
}

/**
 * Query param opsional untuk
 * `GET /api/v1/portfolios/portofolio_performance/{portfolio_id}`
 */
export interface PortfolioPerformanceParams {
  /** Batas akhir perhitungan (inklusif), format "YYYY-MM-DD" -> query `end_date`. */
  endDate?: string;
  /** true = hitung performa portofolio simulasi (backtest). Default false (live). */
  backtest?: boolean;
}

/** Ringkasan return, seluruh persentase memakai skala 100 (10 = 10%). */
export interface PortfolioReturnMetrics {
  performance_days: number;
  /** Alias eksplisit dari total_return_pct, kumulatif selama periode. */
  twr_return_pct: number | null;
  /** NAV akhir dikurangi modal awal dan setoran; Rupiah, bukan kas cair. */
  cash_return: number | null;
  cash_return_pct: number | null;
  /** XIRR dikonversi ke return periode, memperhitungkan tanggal setoran. */
  money_weighted_return_pct: number | null;
  /** XIRR per tahun (Actual/365); null untuk periode < 365 hari. */
  money_weighted_return_annualized_pct: number | null;
  /** Rata-rata geometrik TWR per tahun; null untuk periode < 365 hari. */
  annualized_twr_return_pct: number | null;
  annualization_status: "available" | "insufficient_history" | "unavailable";
}

/** Fields tambahan opsional agar frontend tetap cocok dengan backend lama. */
export interface PortfolioPerformance extends Partial<PortfolioReturnMetrics> {
  /** Hari harga pertama yang benar-benar dapat dihitung. */
  start_date: string;
  /** Tanggal snapshot portofolio pertama yang diminta. */
  requested_start_date: string;
  /** True bila backend menggeser tanggal mulai ke hari pasar yang tersedia. */
  start_date_adjusted: boolean;
  end_date: string;
  holdings: Record<string, number>; // { "BBCA": 2, "BBRI": 5 } — jumlah lot per emiten
  missing_price_tickers: string[];
  initial_capital: number | null;
  total_contributions?: number;
  net_investment_gain?: number | null;
  final_nav: number | null;
  /** Return kumulatif berbobot waktu dalam persen; bukan keuntungan dibagi seluruh setoran. */
  total_return_pct: number | null;
  realized_pnl: number | null;
  unrealized_pnl: number | null;
  /** Dividen bruto yang diakui sebagai piutang dalam NAV; null bila data tidak tersedia. */
  dividend_income: number | null;
  /** Akumulasi biaya tersimpan; null bila pembukuan tidak terverifikasi. */
  transaction_costs: number | null;
  accounting_limitations: string[];
  series: PerformancePoint[];
}
