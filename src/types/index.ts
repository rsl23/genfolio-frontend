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
