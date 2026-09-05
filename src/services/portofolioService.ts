import apiClient from "./apiClient";
import type { PortfolioData, ApiResponse } from "@/types";

/**
 * Service khusus untuk endpoint-endpoint yang berhubungan dengan "Market"
 */
export const portofolioService = {
  /**
   * Mengambil daftar saham yang lolos filter (Fundamental & Teknikal)
   * GET /api/v1/market/filter-stocks
   */
  stockPortofolioGenerate: async (
    body?: Record<string, any>,
  ): Promise<PortfolioData[]> => {
    try {
      // Axios akan otomatis mengubah params menjadi query string
      const response = await apiClient.post<PortfolioData[]>(
        "/api/v1/portfolios/generate",
        body,
      );
      console.log("Response from /api/v1/portfolios/generate:", response.data);
      return response.data;
    } catch (error) {
      // Lemparkan error ke komponen agar bisa ditampilkan ke UI
      throw error;
    }
  },
  getMyPortofolio: async (): Promise<ApiResponse<PortfolioData>> => {
    try {
      const response = await apiClient.get<ApiResponse<PortfolioData>>(
        "/api/v1/portfolios/my-portofolio",
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};
