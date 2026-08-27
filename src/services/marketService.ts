import apiClient from "./apiClient";
import type { FilteredStock } from "@/types";

/**
 * Service khusus untuk endpoint-endpoint yang berhubungan dengan "Market"
 */
export const marketService = {
  /**
   * Mengambil daftar saham yang lolos filter (Fundamental & Teknikal)
   * GET /api/v1/market/filter-stocks
   */
  filterStocks: async (
    params?: Record<string, any>,
  ): Promise<FilteredStock[]> => {
    try {
      // Axios akan otomatis mengubah params menjadi query string
      const response = await apiClient.get<FilteredStock[]>(
        "/api/v1/market/filter-stocks",
        { params },
      );
      return response.data;
    } catch (error) {
      // Lemparkan error ke komponen agar bisa ditampilkan ke UI
      throw error;
    }
  },
};
