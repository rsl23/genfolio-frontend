import apiClient from "./apiClient";
import type {
  PortfolioData,
  ApiResponse,
  MarketData,
  PortfolioPerformance,
  PortfolioPerformanceParams,
  GeneratePortofolioRequest,
  RebalanceSeriesGenerateRequest,
  RebalanceSeriesResult,
  UpdateHargaBeliRequest,
  HargaBeliUpdateResult,
  BearMarketAssessment,
  BearPolicy,
  DeletePortfolioResult,
} from "@/types";

/**
 * Service khusus untuk endpoint-endpoint yang berhubungan dengan "Market"
 */
export const portofolioService = {
  getBearPolicy: async (): Promise<BearPolicy> => {
    const response = await apiClient.get<ApiResponse<{ policy: BearPolicy }>>(
      "/api/v1/portfolios/bear-policy",
    );
    if (!response.data.data) throw new Error("Preferensi alokasi modal tidak tersedia.");
    return response.data.data.policy;
  },
  setBearPolicy: async (policy: BearPolicy): Promise<void> => {
    await apiClient.patch("/api/v1/portfolios/bear-policy", { policy });
  },
  previewBearMarket: async (params: {
    risk_profile: string; backtest: boolean; date_ref?: string;
  }): Promise<BearMarketAssessment> => {
    const response = await apiClient.get<ApiResponse<BearMarketAssessment>>(
      "/api/v1/portfolios/bear-market-preview", { params },
    );
    if (!response.data.data) throw new Error("Pratinjau kondisi pasar tidak tersedia.");
    return response.data.data;
  },
  previewBearSeries: async (
    body: RebalanceSeriesGenerateRequest,
  ): Promise<BearMarketAssessment[]> => {
    const response = await apiClient.post<ApiResponse<{
      scheduled_dates: string[]; assessments: BearMarketAssessment[];
    }>>("/api/v1/portfolios/bear-market-series-preview", body, { timeout: 0 });
    if (!response.data.data) throw new Error("Pratinjau rebalance tidak tersedia.");
    return response.data.data.assessments;
  },
  /**
   * Menjalankan GA untuk membuat portofolio baru.
   * POST /api/v1/portfolios/generate
   *
   * Body: `budget`, `risk_profile`, `backtest`, dan `date_ref` (wajib bila
   * `backtest = true`). Hasil backtest disimpan backend sebagai portofolio
   * berstatus `active_backtest` sehingga tidak mengubah portofolio live.
   *
   */
  stockPortofolioGenerate: async (
    body: GeneratePortofolioRequest,
  ): Promise<ApiResponse<PortfolioData>> => {
    try {
      const response = await apiClient.post<ApiResponse<PortfolioData>>(
        "/api/v1/portfolios/generate",
        body,
        body.rebalance ? { timeout: 0 } : undefined,
      );
      console.log("Response from /api/v1/portfolios/generate:", response.data);
      return response.data;
    } catch (error) {
      // Lemparkan error ke komponen agar bisa ditampilkan ke UI
      throw error;
    }
  },
  /**
   * Membentuk portofolio awal lalu menjalankan rebalance backtest berantai
   * setiap X bulan hingga tanggal akhir simulasi.
   * POST /api/v1/portfolios/generate-rebalance-series
   */
  generateRebalanceSeries: async (
    body: RebalanceSeriesGenerateRequest,
  ): Promise<ApiResponse<RebalanceSeriesResult>> => {
    const response = await apiClient.post<ApiResponse<RebalanceSeriesResult>>(
      "/api/v1/portfolios/generate-rebalance-series",
      body,
      // Satu series menjalankan GA penuh berkali-kali dan dapat berlangsung
      // lebih dari 15 menit. Axios memakai 0 untuk menonaktifkan timeout
      // client; kegagalan backend/jaringan tetap diteruskan sebagai error.
      { timeout: 0 },
    );
    return response.data;
  },
  /** Catat setoran pada portofolio live aktif; baru masuk kas saat rebalance. */
  addLiveCapital: async (amount: number): Promise<ApiResponse<PortfolioData>> => {
    const response = await apiClient.post<ApiResponse<PortfolioData>>(
      "/api/v1/portfolios/my-portfolio/add-capital",
      { amount },
    );
    return response.data;
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
  deletePortfolio: async (
    portfolioId: string,
  ): Promise<ApiResponse<DeletePortfolioResult>> => {
    const response = await apiClient.delete<ApiResponse<DeletePortfolioResult>>(
      `/api/v1/portfolios/my-portfolio/${encodeURIComponent(portfolioId)}`,
    );
    return response.data;
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
