export type RiskProfile = "Konservatif" | "Moderat" | "Agresif" | null;

/**
 * Mode tampilan/eksekusi rekomendasi:
 * - "live"     : portofolio real (status backend "active"), data pasar hari ini.
 * - "backtest" : simulasi historis (status backend "active_backtest").
 */
export type PortfolioMode = "live" | "backtest";

/** Body request POST /api/v1/portfolios/generate */
export interface GeneratePortofolioRequest {
  budget: number; // total modal (IDR)
  risk_profile: RiskProfile | string;
  /** Jawaban kuesioner (dikirim apa adanya; backend mengabaikannya). */
  answers?: Record<string, { value: string; score?: number }>;
  /** true = GA memakai data historis lokal (bukan data pasar hari ini). */
  backtest: boolean;
  /** Tanggal acuan simulasi "YYYY-MM-DD" — WAJIB bila backtest = true. */
  date_ref?: string;
}

/** Body POST /api/v1/portfolios/generate-rebalance-series. */
export interface RebalanceSeriesGenerateRequest {
  budget: number;
  risk_profile: RiskProfile | string;
  /** Tanggal pembentukan portofolio awal, format YYYY-MM-DD. */
  start_date: string;
  /** Batas akhir simulasi, format YYYY-MM-DD dan inklusif. */
  end_date: string;
  /** Rebalance dilakukan setiap X bulan; backend menerima 1 sampai 12. */
  interval_months: number;
}

export interface FormData extends Record<string, string> {
  capital: string;
}

export interface PortfolioData {
  id: string;
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
  allocations: Array<PortofolioItem>;
  narasi_llm: string;
  /**
   * Daftar perubahan posisi hasil rebalance (field baru backend).
   * Hanya ada bila portofolio dibuat dengan `rebalance = true`.
   * Berisi aksi BUY / SELL / HOLD per kode emiten beserta selisih lotnya.
   */
  rebalance_deltas?: RebalanceDelta[];
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
}

export interface PortofolioItem {
  item_id?: string; // id item di DB (untuk PATCH harga beli)
  ticker: string;
  lots: number;
  price_per_lot: number; // per lot (harga_acuan x 100)
  harga_beli?: number; // per lembar — harga beli milik user (bisa diedit via PATCH)
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

export interface ApiResponse<T> {
  status: "success" | "error";
  message: string;
  data: T;
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
  /** Return kumulatif dari modal awal sebagai desimal. */
  portfolio_return: number | null;
  /** Akumulasi P/L terealisasi dari penjualan/rebalance. */
  realized_pnl_cumulative: number | null;
  /** P/L belum terealisasi pada saham yang masih dipegang. */
  unrealized_pnl: number | null;
  ihsg_return: number | null; // return kumulatif IHSG, desimal; null jika belum tersinkron
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

/** Respons data dari GET /api/v1/portfolios/portofolio_performance/{portfolio_id} */
export interface PortfolioPerformance {
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
  final_nav: number | null;
  /** Persentase return total, sudah dikali 100. */
  total_return_pct: number | null;
  realized_pnl: number | null;
  unrealized_pnl: number | null;
  /** Belum didukung backend; bernilai null, bukan nol. */
  dividend_income: number | null;
  /** Belum didukung backend; bernilai null, bukan nol. */
  transaction_costs: number | null;
  accounting_limitations: string[];
  series: PerformancePoint[];
}
