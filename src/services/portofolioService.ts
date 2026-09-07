import apiClient from "./apiClient";
import type {
  PortfolioData,
  ApiResponse,
  MarketData,
  PortfolioPerformance,
  UpdateHargaBeliRequest,
  HargaBeliUpdateResult,
} from "@/types";

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
  priceHistory: async (): Promise<ApiResponse<MarketData>> => {
    try {
      const response = await apiClient.get<ApiResponse<MarketData>>(
        `/api/v1/portfolios/price-history`,
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  portfolioPerformance: async (): Promise<
    ApiResponse<PortfolioPerformance>
  > => {
    try {
      const response = await apiClient.get<ApiResponse<PortfolioPerformance>>(
        `/api/v1/portfolios/portofolio_performance`,
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  /**
   * Mengubah harga beli (per lembar, IDR) pada satu item portofolio ACTIVE
   * milik user. Kepemilikan divalidasi dari JWT di backend.
   * PATCH /api/v1/portfolios/my-portofolio/items/{item_id}/harga-beli
   */
  updateHargaBeli: async (
    itemId: string,
    body: UpdateHargaBeliRequest,
  ): Promise<ApiResponse<HargaBeliUpdateResult>> => {
    try {
      const response = await apiClient.patch<
        ApiResponse<HargaBeliUpdateResult>
      >(
        `/api/v1/portfolios/my-portofolio/items/${itemId}/harga-beli`,
        body,
      );
      console.log("Response from PATCH harga-beli:", response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};
