export type RiskProfile = "Konservatif" | "Moderat" | "Agresif" | null;

export interface FormData {
  capital: string;
  dropReaction: string;
  mainPriority: string;
}

export interface PortfolioData {
  name: string;
  value: number;
  lot: number;
  price: number;
  total: number;
}

export interface HistoricalData {
  year: string;
  portfolio: number;
  ihsg: number;
}
