export type RiskProfile = "Konservatif" | "Moderat" | "Agresif" | null;

export interface FormData extends Record<string, string> {
  capital: string;
}

export interface PortfolioData {
  name: string;
  value: number;
  lot: number;
  price: number;
  total: number;
}

export interface FilteredStock {
  ticker: string;
  companyName?: string;
  closePrice?: number;
  // Tambahkan property lain yang sesuai dengan response dari backend FastAPI Anda
}

export interface HistoricalData {
  year: string;
  portfolio: number;
  ihsg: number;
}
