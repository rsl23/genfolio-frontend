import apiClient from "./apiClient";
import { isAxiosError } from "axios";
import { readPortfolioResponse, type PortfolioProgress } from "@/lib/portfolioProgress";
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
  DeletePortfolioResult,
  PortfolioNewsContextData,
} from "@/types";

async function streamPortfolio<T>(path: string, body: unknown, onProgress: (progress: PortfolioProgress) => void, signal?: AbortSignal): Promise<ApiResponse<T>> {
  try {
    onProgress({ stage: "preparing", title: "Menjalankan analisis portofolio",
      detail: "Mengirim pilihan alokasi Anda dan menunggu pembaruan dari server." });
    const response = await apiClient.post<ReadableStream<Uint8Array>>(path, body,
      { adapter: "fetch", responseType: "stream", timeout: 0, signal,
        headers: { Accept: "text/event-stream, application/json" } });
    return await readPortfolioResponse<ApiResponse<T>>(
      response.data, String(response.headers["content-type"] ?? ""), onProgress, signal);
  } catch (error) {
    // Authentication and validation can fail before SSE starts. Decode their
    // JSON body so existing page error messages keep the server's explanation.
    if (isAxiosError(error) && error.response?.data instanceof ReadableStream) {
      try { error.response.data = await new Response(error.response.data).json(); } catch { /* Keep the original error. */ }
    }
    if ((isAxiosError(error) && error.code === "ERR_NETWORK") || error instanceof TypeError) {
      throw new Error("Koneksi ke server terputus. Server mungkin dihentikan atau dimulai ulang. Periksa riwayat portofolio sebelum menjalankan analisis kembali.");
    }
    throw error;
  }
}

/**
 * Service khusus untuk endpoint-endpoint yang berhubungan dengan "Market"
 */
export const portofolioService = {
  previewBearMarket: async (params: {
    risk_profile: string; backtest: boolean; date_ref?: string;
  }): Promise<BearMarketAssessment> => {
    const response = await apiClient.get<ApiResponse<BearMarketAssessment>>(
      // A cold breadth cache downloads all listed equities before returning.
      "/api/v1/portfolios/bear-market-preview", { params, timeout: 0 },
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
  getPortfolioNews: async (portfolioId: string, signal?: AbortSignal): Promise<PortfolioNewsContextData> => {
    const response = await apiClient.get<ApiResponse<PortfolioNewsContextData>>(
      `/api/v1/portfolios/${portfolioId}/news`, { signal, timeout: 20000 },
    );
    if (!response.data.data) throw new Error(response.data.message || "Berita belum tersedia.");
    return response.data.data;
  },
  stockPortofolioGenerate: async (
    body: GeneratePortofolioRequest,
    onProgress?: (progress: PortfolioProgress) => void,
    signal?: AbortSignal,
  ): Promise<ApiResponse<PortfolioData>> => {
    if (onProgress) {
      return streamPortfolio<PortfolioData>("/api/v1/portfolios/generate", body, onProgress, signal);
    }
    try {
      const response = await apiClient.post<ApiResponse<PortfolioData>>(
        "/api/v1/portfolios/generate",
        body,
        // Unduhan data, GA, dan narasi dapat melebihi 150 detik juga pada
        // generate pertama. Tunggu hasil backend seperti pada rebalance.
        { timeout: 0, signal },
      );
      console.log("Response from /api/v1/portfolios/generate:", response.data);
      return response.data;
    } catch (error) {
      // Lemparkan error ke komponen agar bisa ditampilkan ke UI
      throw error;
    }
  },
  /**
   * Melanjutkan snapshot backtest yang tersimpan dengan rebalance berantai
   * setiap X bulan hingga tanggal akhir simulasi.
   * POST /api/v1/portfolios/generate-rebalance-series
   */
  generateRebalanceSeries: async (
    body: RebalanceSeriesGenerateRequest,
    onProgress?: (progress: PortfolioProgress) => void,
    signal?: AbortSignal,
  ): Promise<ApiResponse<RebalanceSeriesResult>> => {
    if (onProgress) {
      return streamPortfolio<RebalanceSeriesResult>("/api/v1/portfolios/generate-rebalance-series", body, onProgress, signal);
    }
    const response = await apiClient.post<ApiResponse<RebalanceSeriesResult>>(
      "/api/v1/portfolios/generate-rebalance-series",
      body,
      // Satu series menjalankan GA penuh berkali-kali dan dapat berlangsung
      // lebih dari 15 menit. Axios memakai 0 untuk menonaktifkan timeout
      // client; kegagalan backend/jaringan tetap diteruskan sebagai error.
      { timeout: 0, signal },
    );
    return response.data;
  },
  /** Catat setoran pada portofolio live aktif; baru masuk kas saat rebalance. */
  addLiveCapital: async (amount: number, portfolioId: string): Promise<ApiResponse<PortfolioData>> => {
    const response = await apiClient.post<ApiResponse<PortfolioData>>(
      "/api/v1/portfolios/my-portfolio/add-capital",
      { amount, portfolio_id: portfolioId },
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
  setPortfolioActivity: async (
    portfolioId: string, isActive: boolean,
  ): Promise<ApiResponse<{ portfolio_id: string; is_list_active: boolean }>> => {
    const response = await apiClient.patch<ApiResponse<{ portfolio_id: string; is_list_active: boolean }>>(
      `/api/v1/portfolios/my-portfolio/${encodeURIComponent(portfolioId)}/activity`,
      { is_active: isActive },
    );
    return response.data;
  },
  updatePortfolioIdentity: async (
    portfolioId: string,
    body: { name_portofolio: string; description: string | null },
  ): Promise<ApiResponse<PortfolioData>> => {
    const response = await apiClient.patch<ApiResponse<PortfolioData>>(
      `/api/v1/portfolios/my-portfolio/${encodeURIComponent(portfolioId)}/identity`,
      body,
    );
    return response.data;
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
  updateHolding: async (
    portfolioId: string,
    ticker: string,
    body: { jumlah_lot: number; harga_beli: number; expected_lots: number },
  ): Promise<ApiResponse<PortfolioData>> => {
    const response = await apiClient.patch<ApiResponse<PortfolioData>>(
      `/api/v1/portfolios/my-portfolio/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(ticker)}`, body,
    );
    return response.data;
  },
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
