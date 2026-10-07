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
  portfolio_value: number; // nilai portofolio hari itu, dalam Rupiah
  portfolio_return: number; // return kumulatif portofolio, desimal (0.012 = +1.2%)
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
  start_date: string; // tanggal pembuatan portofolio aktif
  end_date: string; // tanggal data terbaru (saham/IHSG)
  holdings: Record<string, number>; // { "BBCA": 2, "BBRI": 5 } — jumlah lot per emiten
  series: PerformancePoint[];
}
