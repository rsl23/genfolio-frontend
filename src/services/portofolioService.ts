import apiClient from "./apiClient";
import type {
  PortfolioData,
  ApiResponse,
  MarketData,
  PortfolioPerformance,
  PortfolioPerformanceParams,
  GeneratePortofolioRequest,
  UpdateHargaBeliRequest,
  HargaBeliUpdateResult,
} from "@/types";

/**
 * Service khusus untuk endpoint-endpoint yang berhubungan dengan "Market"
 */
export const portofolioService = {
  /**
   * Menjalankan GA untuk membuat portofolio baru.
   * POST /api/v1/portfolios/generate
   *
   * Body: `budget`, `risk_profile`, `backtest`, dan `date_ref` (wajib bila
   * `backtest = true`). Hasil backtest disimpan backend sebagai portofolio
   * berstatus `active_backtest` sehingga tidak mengubah portofolio live.
   */
  stockPortofolioGenerate: async (
    body: GeneratePortofolioRequest,
  ): Promise<ApiResponse<PortfolioData>> => {
    try {
      const response = await apiClient.post<ApiResponse<PortfolioData>>(
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
  /**
   * Ambil portofolio aktif milik user (identitas dari JWT).
   * GET /api/v1/portfolios/my-portofolio
   *
   * @param backtest false (default) = portofolio LIVE berstatus "active";
   *                 true = portofolio SIMULASI berstatus "active_backtest".
   *                 Response memuat field `date_ref` (tanggal simulasi untuk
   *                 backtest / waktu generate untuk live).
   */
  getMyPortofolio: async (
    backtest = false,
  ): Promise<ApiResponse<PortfolioData>> => {
    try {
      const response = await apiClient.get<ApiResponse<PortfolioData>>(
        "/api/v1/portfolios/my-portfolio",
        backtest ? { params: { backtest: true } } : undefined,
      );
      console.log(response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  /**
   * Ambil SEMUA portofolio milik user (identitas dari JWT) pada mode terpilih.
   * GET /api/v1/portfolios/my-portofolio/all
   *
   * Mode dibedakan backend lewat query param `backtest`:
   * - backtest=false (default) -> portofolio LIVE
   *       status "active" (terbaru) + "replaced" (sudah digantikan)
   * - backtest=true            -> portofolio BACKTEST
   *       status "active_backtest" + "replaced_backtest"
   *
   * Urutan: created_at terbaru dulu. User tanpa portofolio pada mode tsb
   * menerima list kosong `[]`.
   */
  getAllMyPortofolios: async (
    backtest = false,
  ): Promise<ApiResponse<PortfolioData[]>> => {
    try {
      const response = await apiClient.get<ApiResponse<PortfolioData[]>>(
        "/api/v1/portfolios/my-portfolio/all",
        { params: { backtest } },
      );
      console.log(
        "Response from /api/v1/portfolios/my-portofolio/all:",
        response.data,
      );
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
        `/api/v1/portfolios/portfolio_performance/${portfolioId}`,
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
   * PATCH /api/v1/portfolios/my-portfolio/items/{item_id}/harga-beli
   */
  updateHargaBeli: async (
    itemId: string,
    body: UpdateHargaBeliRequest,
  ): Promise<ApiResponse<HargaBeliUpdateResult>> => {
    try {
      const response = await apiClient.patch<
        ApiResponse<HargaBeliUpdateResult>
      >(`/api/v1/portfolios/my-portfolio/items/${itemId}/harga-beli`, body);
      console.log("Response from PATCH harga-beli:", response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};
