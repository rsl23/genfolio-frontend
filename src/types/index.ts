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
