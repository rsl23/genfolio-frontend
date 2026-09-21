import apiClient from "./apiClient";
import type {
  PortfolioData,
  ApiResponse,
  MarketData,
  PortfolioPerformance,
  PortfolioPerformanceParams,
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
  /**
   * Menghitung performa portofolio TERTENTU (return kumulatif harian) vs IHSG.
   * GET /api/v1/portfolios/portofolio_performance/{portfolio_id}
   *
   * @param portfolioId ID portofolio (UUID) — ambil dari field `id` pada
   *                    response `getMyPortofolio()`.
   * @param params      `endDate` (YYYY-MM-DD, batas akhir perhitungan;
   *                    dikirim sebagai query `end_date`) dan `backtest`
   *                    (true = portofolio simulasi).
   */
  portfolioPerformance: async (
    portfolioId: string,
    params: PortfolioPerformanceParams = {},
  ): Promise<ApiResponse<PortfolioPerformance>> => {
    try {
      // Query param: backtest selalu dikirim (default false = live),
      // end_date hanya bila diberikan.
      const query: Record<string, string | boolean> = {
        backtest: params.backtest ?? false,
      };
      if (params.endDate) query.end_date = params.endDate;

      const response = await apiClient.get<ApiResponse<PortfolioPerformance>>(
        `/api/v1/portfolios/portofolio_performance/${portfolioId}`,
        { params: query },
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
