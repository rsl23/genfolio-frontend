export type RiskProfile = "Konservatif" | "Moderat" | "Agresif" | null;

export interface FormData extends Record<string, string> {
  capital: string;
}

export interface PortfolioData {
  id: string;
  user_id: string;
  fitness_score: number;
  sharpe_ratio: number;
  expected_return: number;
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
  budget: number;
  allocations: Array<PortofolioItem>;
  narasi_llm: string;
}

export interface PortofolioItem {
  ticker: string;
  lots: number;
  price_per_lot: number;
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
  date: string; // "2026-09-04" (ISO date)
  portfolio_value: number; // nilai portofolio hari itu, dalam Rupiah
  portfolio_return: number; // return kumulatif portofolio, desimal (0.012 = +1.2%)
  ihsg_return: number | null; // return kumulatif IHSG, desimal; null jika belum tersinkron
}

/** Respons data dari GET /api/v1/portfolios/portofolio_performance */
export interface PortfolioPerformance {
  start_date: string; // tanggal pembuatan portofolio aktif
  end_date: string; // tanggal data terbaru (saham/IHSG)
  holdings: Record<string, number>; // { "BBCA": 2, "BBRI": 5 } — jumlah lot per emiten
  series: PerformancePoint[];
}
