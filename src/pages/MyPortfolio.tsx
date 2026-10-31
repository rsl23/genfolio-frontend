import { memo, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { parseRupiahInput } from "@/lib/rupiahInput";
import { groupPortfolioSeries } from "@/lib/portfolioSeries";
import { selectPerformanceWindow } from "@/lib/portfolioPerformanceWindow";
import { Label } from "@/components/ui/label";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import BearMarketDialog from "@/components/BearMarketDialog";
import {
  Briefcase,
  TrendingDown,
  Bot,
  Activity,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  X,
  Check,
  FlaskConical,
  History,
  Repeat,
  ChevronDown,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type {
  FormData,
  RiskProfile,
  HistoricalData,
  PortfolioData,
  PortfolioMode,
  MarketData,
  PortfolioPerformance,
  RebalanceDelta,
  BearChoice,
  BearMarketAssessment,
  BearPolicy,
} from "@/types";
import { portofolioService } from "@/services/portofolioService";
import {
  BACKTEST_DATA_MAX,
  BACKTEST_DATA_MIN,
  addDaysIso,
  defaultBacktestEndDate,
  getBacktestDateRef,
  getCachedPortfolio,
  getPortfolioMode,
  getTodayIsoDate,
  setBacktestDateRef,
  setCachedPortfolio,
  setPortfolioMode,
} from "@/lib/portfolioMode";

function portfolioActionError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return error instanceof Error ? error.message : fallback;
}

const COLORS = ["#117a58", "#e0a83a", "#2b8a9a", "#c25b3a", "#8b5cf6"];

/** Badge warna untuk aksi rebalance (BUY / SELL / HOLD) */
function RebalanceActionBadge({
  action,
}: {
  action: RebalanceDelta["action"];
}) {
  const styles: Record<RebalanceDelta["action"], string> = {
    BUY: "bg-emerald-100 text-emerald-800 border-emerald-200",
    SELL: "bg-red-100 text-red-800 border-red-200",
    HOLD: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[action]}`}
    >
      {action}
    </span>
  );
}

interface PortfolioItem {
  name: string;
  value: number;
  lot: number;
  price: number;
  total: number;
}

const mockPortfolioData: PortfolioItem[] = [
  { name: "BBCA", value: 50, lot: 401, price: 6225, total: 249622500 },
  { name: "ICBP", value: 30, lot: 226, price: 6625, total: 149725000 },
  { name: "TLKM", value: 20, lot: 401, price: 2510, total: 100651000 },
];

const mockHistoricalData: HistoricalData[] = [
  { year: "2020", portfolio: 0, ihsg: 0 },
  { year: "2021", portfolio: 8, ihsg: 5 },
  { year: "2022", portfolio: 15, ihsg: 9 },
  { year: "2023", portfolio: 28, ihsg: 14 },
];

/** Jumlah titik maksimum yang digambar di chart performa (downsampling). */
const MAX_CHART_POINTS = 150;

interface ChartPoint {
  date: string;
  portfolio: number | null;
  ihsg: number | null;
}

/**
 * Chart performa dibungkus `memo`: merender Recharts dengan ratusan titik
 * itu mahal, dan setiap ketikan pada form edit harga beli memicu re-render
 * halaman — dengan memo + data yang stabil (useMemo), chart tidak di-render
 * ulang saat state lain berubah.
 */
const PerformanceChart = memo(function PerformanceChart({
  data,
  portfolioLineColor,
}: {
  data: ChartPoint[];
  portfolioLineColor: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#e7e0d3"
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8c8f85", fontSize: 12 }}
          dy={10}
          interval="preserveStartEnd"
          tickFormatter={(val: string) => val.slice(5)} // tampil "MM-DD"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8c8f85" }}
          dx={-10}
          tickFormatter={(val) => `${val}%`}
          domain={["auto", "auto"]}
        />
        <RechartsTooltip
          formatter={(value) =>
            value == null
              ? "Data tidak tersedia"
              : `${Number(value).toFixed(2)}%`
          }
          cursor={{ stroke: "#d8d0bf", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          wrapperStyle={{ paddingBottom: "20px" }}
        />
        {/* dot={false}: ratusan lingkaran SVG per garis adalah biaya render
            terbesar Recharts — cukup activeDot yang muncul saat hover */}
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Return Portofolio (%)"
          stroke={portfolioLineColor}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="ihsg"
          name="Return IHSG (%)"
          stroke="#e0a83a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

/**
 * Menjalankan satu promise dan mengembalikan hasilnya dalam bentuk
 * "settled" (fulfilled/rejected) sehingga kegagalan satu request tidak
 * membatalkan request lain.
 */
async function settle<T>(
  promise: Promise<T>,
): Promise<PromiseSettledResult<T>> {
  try {
    return { status: "fulfilled", value: await promise };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

/**
 * true bila `status_portofolio` milik mode tertentu. Dipakai untuk memastikan
 * portofolio yang dipilih dari halaman Riwayat Portofolio memang berasal dari
 * mode yang sedang aktif (live vs backtest tidak pernah tercampur).
 */
function isStatusForMode(status: string, mode: PortfolioMode): boolean {
  if (mode === "backtest") {
    return status === "active_backtest" || status === "replaced_backtest";
  }
  return status === "active" || status === "replaced";
}

export default function MyPortfolio() {
  const location = useLocation();
  const state = location.state as {
    formData: FormData;
    riskProfile: RiskProfile;
    /** Diisi halaman Rekomendasi Baru saat navigasi ke halaman ini. */
    mode?: PortfolioMode;
    dateRef?: string | null;
    portfolio?: PortfolioData | null;
    /**
     * Diisi halaman Riwayat Portofolio (/portfolios) saat user memilih satu
     * portofolio tertentu — menandai agar `portfolio` di atas ditampilkan
     * persis (bukan selalu portofolio terbaru) selama statusnya sesuai mode.
     */
    selectedPortfolioId?: string;
    /** Portofolio awal yang dipilih pada kartu daftar. */
    selectedRootPortfolioId?: string;
  } | null;

  // ===== Mode program: "live" (portofolio aktif) / "backtest" (simulasi) =====
  // Prioritas: state navigasi -> preferensi tersimpan. Dengan begitu pilihan
  // mode tetap konsisten antar halaman maupun setelah halaman direload.
  const [mode, setMode] = useState<PortfolioMode>(
    () => state?.mode ?? getPortfolioMode(),
  );
  // Tanggal simulasi (date_ref) portofolio backtest yang sedang dilihat
  const [dateRef, setDateRef] = useState<string | null>(
    () => state?.dateRef ?? getBacktestDateRef(),
  );
  // Batas akhir kurva backtest (query `end_date`); default data historis terakhir
  const [endDate, setEndDate] = useState<string>(() =>
    defaultBacktestEndDate(),
  );

  // ===== Ambil portofolio terbaru dari backend setiap kali halaman di-render =====
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [performanceView, setPerformanceView] = useState<{
    key: string;
    scope: "period" | "overall";
  }>(() => ({ key: location.key, scope: "period" }));
  const performanceScope =
    performanceView.key === location.key ? performanceView.scope : "period";
  const [allSnapshots, setAllSnapshots] = useState<PortfolioData[]>([]);
  const [snapshotHistoryError, setSnapshotHistoryError] = useState(false);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(
    null,
  );
  const [performanceSourceKey, setPerformanceSourceKey] = useState<
    string | null
  >(null);
  // ===== State edit harga beli (inline di tabel) =====
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingTicker, setSavingTicker] = useState<string | null>(null);
  // Map ticker -> harga beli user yang sudah tersimpan di backend
  const [hargaBeliMap, setHargaBeliMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  // ===== Rebalance series (khusus backtest) =====
  // Endpoint backend membentuk portofolio awal di start_date, lalu menjalankan
  // rebalance berantai setiap X bulan sampai end_date.
  const [rebalanceStartDate, setRebalanceStartDate] = useState(
    () => state?.dateRef ?? getBacktestDateRef() ?? BACKTEST_DATA_MIN,
  );
  const [rebalanceEndDate, setRebalanceEndDate] = useState(() =>
    defaultBacktestEndDate(),
  );
  const [rebalanceIntervalMonths, setRebalanceIntervalMonths] = useState(3);
  const [contributionAmountInput, setContributionAmountInput] = useState("");
  const [contributionIntervalMonths, setContributionIntervalMonths] =
    useState(1);
  const [liveDepositAmountInput, setLiveDepositAmountInput] = useState("");
  const [isSavingDeposit, setIsSavingDeposit] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);
  const [depositFailed, setDepositFailed] = useState(false);
  const [isRunningRebalance, setIsRunningRebalance] = useState(false);
  const [isPreviewingBear, setIsPreviewingBear] = useState(false);
  const [liveBearPreview, setLiveBearPreview] =
    useState<BearMarketAssessment | null>(null);
  const [seriesBearPreview, setSeriesBearPreview] = useState<
    BearMarketAssessment[] | null
  >(null);
  const [bearPolicy, setBearPolicy] = useState<BearPolicy>("manual");
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [rebalanceSummary, setRebalanceSummary] = useState<string | null>(null);
  const selectedSeries = useMemo(() => {
    const groups = groupPortfolioSeries(allSnapshots, mode);
    return (
      groups.find((group) =>
        group.snapshots.some((snapshot) => snapshot.id === portfolio?.id),
      ) ?? null
    );
  }, [allSnapshots, mode, portfolio?.id]);
  const performancePortfolioId =
    selectedSeries?.latest.id ?? (snapshotHistoryError ? portfolio?.id : null);
  const performanceRequestKey = performancePortfolioId
    ? `${mode}:${performancePortfolioId}:${mode === "backtest" ? endDate : "latest"}`
    : null;
  const effectivePerformance =
    performanceSourceKey === performanceRequestKey ? performance : null;
  const latestSnapshotDay =
    selectedSeries?.latest.execution_date?.slice(0, 10) ??
    selectedSeries?.latest.date_ref?.slice(0, 10) ??
    dateRef;
  const performanceWindow = useMemo(
    () =>
      effectivePerformance && portfolio && selectedSeries
        ? selectPerformanceWindow(
            effectivePerformance,
            selectedSeries.snapshots,
            portfolio.id,
            performanceScope,
          )
        : null,
    [effectivePerformance, portfolio, selectedSeries, performanceScope],
  );
  const displayPerformance = performanceWindow?.data ?? effectivePerformance;

  useEffect(() => {
    let cancelled = false;
    void portofolioService
      .getAllMyPortofolios(mode === "backtest")
      .then((response) => {
        if (cancelled) return;
        if (response.status === "success" && Array.isArray(response.data)) {
          setAllSnapshots(response.data);
        } else {
          setSnapshotHistoryError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSnapshotHistoryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, location.key, historyRefreshToken]);

  /** Ganti mode program (Live <-> Backtest) dan simpan preferensinya. */
  const handleModeChange = (next: PortfolioMode) => {
    if (next === mode) return;
    setPortfolioMode(next);
    setMode(next);
    setPerformanceView({ key: location.key, scope: "period" });
    setAllSnapshots([]);
    setSnapshotHistoryError(false);
    // Edit harga beli dibatalkan saat berpindah mode
    setEditingTicker(null);
    setEditError(null);
    if (next === "backtest") {
      // Prioritas date_ref: cache portofolio backtest terakhir (field
      // `date_ref` dari backend), lalu preferensi tersimpan.
      const cached = getCachedPortfolio("backtest");
      const nextDate = cached?.date_ref?.slice(0, 10) ?? getBacktestDateRef();
      setDateRef(nextDate);
      if (nextDate) setRebalanceStartDate(nextDate);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // ===== Portofolio SPESIFIK dari halaman Riwayat Portofolio =====
        // Saat user memilih satu portofolio di /portfolios, tampilkan persis
        // portofolio itu (bisa berstatus "replaced" yang bukan terbaru).
        // Syarat: id cocok dengan `selectedPortfolioId` DAN statusnya memang
        // milik mode aktif — sehingga toggle Live/Backtest tetap konsisten
        // dan tidak pernah menampilkan portofolio dari mode lain.
        const selectedPortfolio =
          state?.portfolio &&
          state.portfolio.id === state.selectedPortfolioId &&
          isStatusForMode(state.portfolio.status_portofolio, mode)
            ? state.portfolio
            : null;

        if (selectedPortfolio) {
          setPortfolio(selectedPortfolio);
          if (mode === "backtest") {
            const selectedDateRef =
              selectedPortfolio.date_ref?.slice(0, 10) ?? null;
            if (selectedDateRef) {
              setDateRef(selectedDateRef);
              setRebalanceStartDate(selectedDateRef);
              setBacktestDateRef(selectedDateRef);
            }
            // Data pasar harian tidak tersedia untuk tanggal simulasi
            setMarketData(null);
            return;
          }
          // Mode live: tetap ambil harga pasar terkini untuk kolom "Harga Pasar"
          setCachedPortfolio("live", selectedPortfolio);
          const marketRes = await settle(portofolioService.priceHistory());
          if (cancelled) return;
          setMarketData(
            marketRes.status === "fulfilled" && marketRes.value.data
              ? marketRes.value.data
              : null,
          );
          return;
        }

        if (mode === "backtest") {
          // Mode simulasi TIDAK memakai endpoint live. Sumber portofolio:
          // 1) response GET /my-portofolio?backtest=true — sumber paling
          //    resmi & terbaru (date_ref ikut dari DB), dipakai sepanjang
          //    benar-benar berstatus "active_backtest";
          // 2) fallback bila request gagal/kosong: hasil generate (state
          //    navigasi) atau cache localStorage.
          let data: PortfolioData | null = null;

          const res = await settle(portofolioService.getMyPortofolio(true));
          if (cancelled) return;
          if (
            res.status === "fulfilled" &&
            res.value.status === "success" &&
            res.value.data &&
            res.value.data.status_portofolio === "active_backtest"
          ) {
            data = res.value.data;
          } else if (res.status === "rejected") {
            console.warn(
              "[MyPortfolio] Portofolio backtest tidak dapat dimuat dari server:",
              res.reason,
            );
          }

          if (!data) {
            data = state?.portfolio ?? getCachedPortfolio("backtest");
          }

          if (cancelled) return;
          setPortfolio(data);
          if (data) setCachedPortfolio("backtest", data);

          // date_ref HANYA dipercaya dari field portofolio (backend/response
          // generate). localStorage/state dipakai sebagai fallback terakhir
          // bila data tidak memuat date_ref, supaya tanggal simulasi yang
          // tampil selalu sesuai portofolio yang aktif di server.
          const portfolioDateRef = data?.date_ref?.slice(0, 10) ?? null;
          if (portfolioDateRef) {
            setDateRef(portfolioDateRef);
            setRebalanceStartDate(portfolioDateRef);
            setBacktestDateRef(portfolioDateRef);
          } else {
            const fallbackDate = state?.dateRef ?? getBacktestDateRef();
            setDateRef(fallbackDate);
            if (fallbackDate) setRebalanceStartDate(fallbackDate);
          }

          // Harga pasar harian tidak tersedia untuk tanggal simulasi
          setMarketData(null);
          return;
        }

        // ===== Mode LIVE =====
        // Portofolio diambil lebih dulu karena field `id`-nya dipakai sebagai
        // path param endpoint performa (lihat efek kedua di bawah).
        const portfolioRes = await settle(portofolioService.getMyPortofolio());

        if (cancelled) return;

        const portfolioData =
          portfolioRes.status === "fulfilled" &&
          portfolioRes.value.status === "success" &&
          portfolioRes.value.data
            ? portfolioRes.value.data
            : null;
        setPortfolio(portfolioData);
        if (portfolioData) setCachedPortfolio("live", portfolioData);

        // Data pasar (harga terkini) untuk kolom "Harga Pasar"
        const marketRes = await settle(portofolioService.priceHistory());
        if (cancelled) return;
        if (marketRes.status === "fulfilled" && marketRes.value.data) {
          setMarketData(marketRes.value.data);
        } else {
          setMarketData(null);
          console.error("Gagal mengambil data pasar:", marketRes);
        }

        if (portfolioRes.status === "rejected") {
          console.error("Gagal mengambil portofolio:", portfolioRes.reason);
          setFetchError(
            "Gagal memuat portofolio dari server. Menampilkan data simulasi.",
          );
        }
      } catch (err) {
        console.error("Gagal mengambil portofolio:", err);
        if (!cancelled) {
          setFetchError(
            "Gagal memuat portofolio dari server. Menampilkan data simulasi.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPortfolio();
    return () => {
      cancelled = true;
    };
    // location.key berubah setiap kali navigasi ke halaman ini terjadi,
    // sehingga portofolio selalu diperbarui (mis. setelah GA selesai dijalankan)
    // Mode ikut jadi dependency agar tombol Live/Backtest memuat ulang data.
  }, [location.key, mode, state]);

  // ===== Efek 2: muat performa (return portofolio vs IHSG) =====
  // Dipisah dari efek 1 agar mengganti tanggal akhir kurva (end_date) tidak
  // memicu pemuatan ulang portofolio & data pasar.
  useEffect(() => {
    let cancelled = false;

    const loadPerformance = async () => {
      const portfolioId = performancePortfolioId;
      if (!portfolioId) {
        setPerformance(null);
        setPerformanceSourceKey(null);
        setPerformanceError(null);
        return;
      }
      // end_date minimal = HARI SETELAH tanggal simulasi (date_ref + 1),
      // supaya kurva performa selalu punya minimal 2 titik data.
      if (
        mode === "backtest" &&
        latestSnapshotDay &&
        endDate <= latestSnapshotDay
      ) {
        setPerformance(null);
        setPerformanceSourceKey(null);
        setPerformanceError(
          `Tanggal akhir kurva (${endDate}) harus setelah snapshot terakhir ` +
            `(${latestSnapshotDay}). Pilih minimal ${addDaysIso(latestSnapshotDay, 1)}.`,
        );
        return;
      }

      const res = await settle(
        portofolioService.portfolioPerformance(portfolioId, {
          // Mode live: hitung sampai data terbaru. Mode backtest: sampai
          // tanggal akhir yang dipilih user.
          endDate: mode === "backtest" ? endDate : getTodayIsoDate(),
          backtest: mode === "backtest",
        }),
      );
      if (cancelled) return;

      if (
        res.status === "fulfilled" &&
        res.value.status === "success" &&
        res.value.data
      ) {
        setPerformance(res.value.data);
        setPerformanceSourceKey(performanceRequestKey);
        setPerformanceError(null);
      } else {
        setPerformance(null);
        setPerformanceSourceKey(null);
        const reason =
          res.status === "rejected"
            ? res.reason instanceof Error
              ? res.reason.message
              : String(res.reason)
            : `status="${res.value?.status}" / message="${res.value?.message}"`;
        setPerformanceError(reason);
        console.error("Gagal mengambil data performa:", res);
      }
    };

    loadPerformance();
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    performancePortfolioId,
    performanceRequestKey,
    endDate,
    latestSnapshotDay,
  ]);

  // Diagnostik: cek field portofolio yang mungkin tidak dikirim backend
  useEffect(() => {
    if (portfolio && portfolio.max_drawdown == null) {
      console.warn(
        "[MyPortfolio] Field 'max_drawdown' tidak ada/null di response " +
          "GET /my-portofolio. Tile Max Drawdown menampilkan '—'. " +
          `Field yang tersedia: ${Object.keys(portfolio).join(", ")}.`,
      );
    }
  }, [portfolio]);

  const rebalanceIntervalValid =
    Number.isInteger(rebalanceIntervalMonths) &&
    rebalanceIntervalMonths >= 1 &&
    rebalanceIntervalMonths <= 12;
  const rebalanceDateRangeValid =
    rebalanceStartDate >= BACKTEST_DATA_MIN &&
    rebalanceStartDate <= BACKTEST_DATA_MAX &&
    rebalanceEndDate >= rebalanceStartDate &&
    rebalanceEndDate <= BACKTEST_DATA_MAX;
  const contributionAmount = parseRupiahInput(contributionAmountInput);
  const liveDepositAmount = parseRupiahInput(liveDepositAmountInput);
  const contributionValid =
    Number.isFinite(contributionAmount) &&
    contributionAmount >= 0 &&
    Number.isInteger(contributionIntervalMonths) &&
    contributionIntervalMonths >= 1 &&
    contributionIntervalMonths <= 12;

  const addLiveCapital = async () => {
    if (
      !portfolio ||
      !Number.isFinite(liveDepositAmount) ||
      liveDepositAmount <= 0
    )
      return;
    setIsSavingDeposit(true);
    setDepositMessage(null);
    setDepositFailed(false);
    try {
      const response =
        await portofolioService.addLiveCapital(liveDepositAmount);
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || "Setoran tidak berhasil dicatat.");
      }
      setPortfolio(response.data);
      setCachedPortfolio("live", response.data);
      setLiveDepositAmountInput("");
      setDepositMessage(
        "Setoran tercatat. Dana akan menjadi kas pada rebalance live berikutnya.",
      );
    } catch (error) {
      setDepositFailed(true);
      setDepositMessage(portfolioActionError(error, "Gagal mencatat setoran."));
    } finally {
      setIsSavingDeposit(false);
    }
  };

  const runLiveRebalance = async () => {
    if (!portfolio) return;
    setIsPreviewingBear(true);
    setRebalanceError(null);
    setRebalanceSummary(null);
    try {
      const [policy, preview] = await Promise.all([
        portofolioService.getBearPolicy(),
        portofolioService.previewBearMarket({
          risk_profile: portfolio.risk_profile,
          backtest: false,
        }),
      ]);
      setBearPolicy(policy);
      setLiveBearPreview(preview);
    } catch (error) {
      setRebalanceError(
        portfolioActionError(error, "Gagal memeriksa kondisi pasar."),
      );
    } finally {
      setIsPreviewingBear(false);
    }
  };

  const confirmLiveRebalance = async (
    policy: BearPolicy,
    choices: Record<string, BearChoice>,
  ) => {
    if (!portfolio || !liveBearPreview) return;
    setIsRunningRebalance(true);
    setRebalanceError(null);
    try {
      if (policy !== bearPolicy) await portofolioService.setBearPolicy(policy);
      const response = await portofolioService.stockPortofolioGenerate({
        budget: portfolio.budget,
        risk_profile: portfolio.risk_profile,
        backtest: false,
        rebalance: true,
        bear_management: true,
        bear_choice: choices[liveBearPreview.requested_date],
        bear_preview_as_of: liveBearPreview.as_of,
        bear_preview_fingerprint: liveBearPreview.fingerprint,
      });
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || "Rebalance live gagal.");
      }
      setPortfolio(response.data);
      setCachedPortfolio("live", response.data);
      setDepositMessage(null);
      setHistoryRefreshToken((token) => token + 1);
      setRebalanceSummary(
        "Rebalance live selesai. Setoran yang menunggu sudah masuk perhitungan kas dan NAV.",
      );
      setLiveBearPreview(null);
    } catch (error) {
      setRebalanceError(
        portfolioActionError(error, "Gagal menjalankan rebalance live."),
      );
    } finally {
      setIsRunningRebalance(false);
    }
  };

  const runRebalanceSeries = async () => {
    if (
      !portfolio ||
      !rebalanceIntervalValid ||
      !rebalanceDateRangeValid ||
      !contributionValid
    ) {
      return;
    }

    setIsPreviewingBear(true);
    setRebalanceError(null);
    setRebalanceSummary(null);
    try {
      const [policy, preview] = await Promise.all([
        portofolioService.getBearPolicy(),
        portofolioService.previewBearSeries({
          budget: effectivePerformance?.initial_capital ?? portfolio.budget,
          name_portofolio: portfolio.name_portofolio ?? undefined,
          description: portfolio.description ?? null,
          risk_profile: portfolio.risk_profile,
          start_date: rebalanceStartDate,
          end_date: rebalanceEndDate,
          interval_months: rebalanceIntervalMonths,
          contribution_amount: contributionAmount,
          contribution_interval_months:
            contributionAmount > 0 ? contributionIntervalMonths : undefined,
        }),
      ]);
      setBearPolicy(policy);
      setSeriesBearPreview(preview);
    } catch (error) {
      setRebalanceError(
        portfolioActionError(
          error,
          "Gagal memeriksa kondisi pasar untuk series.",
        ),
      );
    } finally {
      setIsPreviewingBear(false);
    }
  };

  const confirmRebalanceSeries = async (
    policy: BearPolicy,
    choices: Record<string, BearChoice>,
  ) => {
    if (!portfolio || !seriesBearPreview) return;
    setIsRunningRebalance(true);
    setRebalanceError(null);
    try {
      if (policy !== bearPolicy) await portofolioService.setBearPolicy(policy);
      const response = await portofolioService.generateRebalanceSeries({
        budget: effectivePerformance?.initial_capital ?? portfolio.budget,
        name_portofolio: portfolio.name_portofolio ?? undefined,
        description: portfolio.description ?? null,
        risk_profile: portfolio.risk_profile,
        start_date: rebalanceStartDate,
        end_date: rebalanceEndDate,
        interval_months: rebalanceIntervalMonths,
        contribution_amount: contributionAmount,
        contribution_interval_months:
          contributionAmount > 0 ? contributionIntervalMonths : undefined,
        bear_management: true,
        bear_choices: choices,
        bear_preview_dates: Object.fromEntries(
          seriesBearPreview
            .filter((item) => item.as_of)
            .map((item) => [item.scheduled_date!, item.as_of!]),
        ),
        bear_preview_fingerprints: Object.fromEntries(
          seriesBearPreview.map((item) => [
            item.scheduled_date!,
            item.fingerprint,
          ]),
        ),
      });

      if (response.status !== "success" || !response.data) {
        throw new Error(
          response.message || "Backend tidak mengembalikan hasil rebalance.",
        );
      }

      const latest = response.data.portfolios.at(-1) ?? null;
      if (latest) {
        setPortfolio(latest);
        setCachedPortfolio("backtest", latest);
        setHistoryRefreshToken((token) => token + 1);
        const latestDate = latest.date_ref?.slice(0, 10) ?? rebalanceEndDate;
        setDateRef(latestDate);
        setRebalanceStartDate(latestDate);
        setBacktestDateRef(latestDate);
      }
      setRebalanceSummary(
        `${response.data.portfolios.length} portofolio berhasil dibuat dari ` +
          `${response.data.scheduled_dates.length} tanggal terjadwal` +
          (response.data.skipped.length
            ? `; ${response.data.skipped.length} tanggal dilewati.`
            : ".") +
          (response.data.evaluation_mode === "what_if"
            ? " Pilihan historis manual ini adalah simulasi what-if."
            : ""),
      );
      setSeriesBearPreview(null);
    } catch (error) {
      const message = portfolioActionError(
        error,
        "Gagal menjalankan rebalance series. Coba lagi.",
      );
      setRebalanceError(message);
    } finally {
      setIsRunningRebalance(false);
    }
  };

  // ===== Data tampilan: pakai data asli dari backend, fallback ke mock =====
  const isMock = !portfolio;
  const formData = state?.formData || {
    capital: "500000000",
    dropReaction: "a",
    mainPriority: "a",
  };
  const riskProfile =
    portfolio?.risk_profile ?? state?.riskProfile ?? "Konservatif";
  const budget = portfolio?.budget ?? Number(formData.capital);

  const formattedRupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 2,
    }).format(value);

  // Data untuk pie chart & tabel: dari GA asli, atau mock
  const holdings = portfolio
    ? portfolio.allocations.map((a) => ({
        name: a.ticker,
        value: Math.round(a.weight * 10000) / 100, // weight -> persen
        lot: a.lots,
        price: a.price_per_lot,
        total: a.allocation,
        itemId: a.item_id, // id item di DB untuk PATCH harga beli
        hargaBeli: a.harga_beli, // per lembar, dari backend
      }))
    : mockPortfolioData.map((m) => ({
        ...m,
        itemId: undefined,
        hargaBeli: undefined,
      }));

  const budgetOk = portfolio?.allocated_budget_ok ?? true;

  // Map ticker -> daftar harga dari marketData
  const marketPriceMap: Record<string, number[]> = marketData
    ? Object.fromEntries(
        marketData.stocks.map((s) => [s.ticker, s.prices.map((p) => p.close)]),
      )
    : {};

  const formatRupiahAngka = (value: number) =>
    value.toLocaleString("id-ID", { maximumFractionDigits: 0 });

  /**
   * Harga pasar terbaru untuk sebuah ticker:
   * 1. Ambil harga close TERAKHIR dari marketData (apa pun jumlah barisnya,
   *    termasuk jika hanya ada 1 harga = harga pembelian).
   * 2. Jika ticker tidak ada di marketData, fallback ke harga pembelian
   *    (price_per_lot dari GA dibagi 100).
   */
  const getMarketPrice = (ticker: string, buyPricePerShare: number): number => {
    const closes = marketPriceMap[ticker];
    if (closes && closes.length > 0) {
      return closes[closes.length - 1];
    }
    // Diagnostik hanya relevan di mode live: pada mode backtest harga pasar
    // memang tidak diambil (tidak ada data as-of tanggal simulasi).
    if (mode === "live") {
      if (marketData) {
        console.warn(
          `[MyPortfolio] Ticker "${ticker}" tidak ditemukan di market-data. ` +
            `Ticker tersedia: ${Object.keys(marketPriceMap).join(", ")}. ` +
            `Menggunakan harga pembelian sebagai fallback.`,
        );
      } else {
        console.warn(
          `[MyPortfolio] Data market-data tidak tersedia. ` +
            `Menggunakan harga pembelian untuk "${ticker}".`,
        );
      }
    }
    return buyPricePerShare;
  };

  // ===== Handler edit harga beli =====
  // Batas validasi harga beli (per lembar, IDR)
  const HARGA_BELI_MIN = 1;
  const HARGA_BELI_MAX = 1_000_000;

  const validateHargaBeli = (raw: string): number | null => {
    const hargaBeli = Number(raw.replace(/\D/g, ""));
    if (!raw || Number.isNaN(hargaBeli) || hargaBeli <= 0) {
      setEditError("Harga beli wajib diisi dan harus lebih dari 0.");
      return null;
    }
    if (hargaBeli < HARGA_BELI_MIN) {
      setEditError(
        `Harga beli minimal Rp ${HARGA_BELI_MIN.toLocaleString("id-ID")}.`,
      );
      return null;
    }
    if (hargaBeli > HARGA_BELI_MAX) {
      setEditError(
        `Harga beli maksimal Rp ${HARGA_BELI_MAX.toLocaleString("id-ID")}.`,
      );
      return null;
    }
    setEditError(null);
    return hargaBeli;
  };

  const hargaAcuanPerLembar = (item: (typeof holdings)[number]) =>
    Number(item.price) / 100; // price_per_lot dari GA -> per lembar

  const hargaBeliTerpakai = (item: (typeof holdings)[number]) =>
    // Prioritas: hasil edit tersimpan (state) -> harga_beli dari backend ->
    // fallback harga acuan GA
    hargaBeliMap[item.name] ?? item.hargaBeli ?? hargaAcuanPerLembar(item);

  const startEdit = (item: (typeof holdings)[number]) => {
    setEditingTicker(item.name);
    setEditValue(String(Math.round(hargaBeliTerpakai(item))));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingTicker(null);
    setEditValue("");
    setEditError(null);
  };

  const saveEdit = async (item: (typeof holdings)[number]) => {
    // Validasi: wajib diisi, > 0, dan tidak melebihi batas atas
    const hargaBeli = validateHargaBeli(editValue);
    if (hargaBeli === null) {
      console.error("[MyPortfolio] Harga beli tidak valid:", editValue);
      return;
    }
    if (!item.itemId) {
      console.error(
        `[MyPortfolio] item_id untuk "${item.name}" tidak tersedia dari backend. ` +
          `Pastikan response GET /my-portofolio menyertakan field "item_id" pada setiap allocation.`,
      );
      cancelEdit();
      return;
    }

    setSavingTicker(item.name);
    try {
      const res = await portofolioService.updateHargaBeli(item.itemId, {
        harga_beli: hargaBeli,
      });
      if (res.status === "success") {
        // Simpan harga beli baru ke tampilan
        setHargaBeliMap((prev) => ({
          ...prev,
          [item.name]: res.data.harga_beli,
        }));
        // Refresh portofolio agar total_investasi / terpakai / sisa budget terbaru
        try {
          const refresh = await portofolioService.getMyPortofolio();
          if (refresh.status === "success" && refresh.data) {
            setPortfolio(refresh.data);
          }
        } catch (refreshErr) {
          console.error("Gagal refresh portofolio:", refreshErr);
        }
      }
      cancelEdit();
    } catch (err) {
      console.error("Gagal memperbarui harga beli:", err);
      window.alert("Gagal memperbarui harga beli. Silakan coba lagi nanti.");
    } finally {
      setSavingTicker(null);
    }
  };

  // ===== Data chart performa: return portofolio vs IHSG (%) =====
  // Downsampling: kurva backtest/live bisa ratusan titik harian. Recharts
  // jauh lebih ringan dengan ~150 titik; bentuk kurva tetap terbaca dan
  // titik pertama & terakhir SELALU dipertahankan (return terakhir akurat).
  const performanceChartData = useMemo(() => {
    const raw =
      displayPerformance?.series.map((p) => ({
        // Backend mode backtest mengirim "2024-06-28T00:00:00" — ambil
        // bagian tanggalnya saja agar label sumbu X & tooltip bersih.
        date: p.date.slice(0, 10),
        portfolio:
          p.portfolio_return == null
            ? null
            : Math.round(p.portfolio_return * 10000) / 100, // desimal -> %
        ihsg:
          p.ihsg_return == null
            ? null
            : Math.round(p.ihsg_return * 10000) / 100,
      })) ?? [];
    if (raw.length <= MAX_CHART_POINTS) return raw;
    const step = Math.ceil(raw.length / MAX_CHART_POINTS);
    const sampled = raw.filter((_, index) => index % step === 0);
    const last = raw[raw.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  }, [displayPerformance]);

  const hasPerformanceData =
    performanceChartData.filter((point) => point.portfolio !== null).length >=
    2;
  const lastPoint =
    performanceChartData[performanceChartData.length - 1] ?? null;

  // ===== Warna garis =====
  // Portofolio: dinamis — hijau saat return >= 0, merah saat return < 0.
  // IHSG: SELALU kuning tetap (#e0a83a, didefinisikan di PerformanceChart)
  // sebagai benchmark agar tidak pernah sama dengan garis portofolio.
  const portfolioLineColor =
    lastPoint?.portfolio != null && lastPoint.portfolio < 0
      ? "#dc2626"
      : "#117a58"; // merah / hijau

  // Keuntungan bersih mengeluarkan setoran eksternal dari pertumbuhan NAV.
  const totalPnl =
    displayPerformance?.net_investment_gain != null
      ? displayPerformance.net_investment_gain
      : displayPerformance?.realized_pnl != null &&
          displayPerformance.unrealized_pnl != null
        ? displayPerformance.realized_pnl + displayPerformance.unrealized_pnl
        : null;
  const latestPerformancePoint = displayPerformance?.series.at(-1) ?? null;

  // ===== Batas date picker end_date (mode backtest) =====
  // Minimal HARI SETELAH tanggal simulasi (date_ref + 1) agar kurva punya
  // minimal 2 titik data, maksimal data historis terakhir (BACKTEST_DATA_MAX).
  const minEndDate = latestSnapshotDay
    ? addDaysIso(latestSnapshotDay, 1)
    : BACKTEST_DATA_MIN;
  const isEndDateValid = endDate >= minEndDate && endDate <= BACKTEST_DATA_MAX;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Portofolio
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            {portfolio?.name_portofolio || "Portofolio Saya"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {portfolio?.description ||
              "Nilai, performa, dan komposisi investasi Anda dalam satu halaman."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/portfolios" className="w-full sm:w-auto">
            <Button variant="outline" className="h-10 gap-2">
              <History className="h-4 w-4" /> Riwayat
            </Button>
          </Link>
          <Link to="/generate" state={{ mode }} className="w-full sm:w-auto">
            <Button className="h-10 gap-2">
              <Plus className="h-4 w-4" />
              Rekomendasi Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* ===== Toolbar: pilih program Live atau Backtest ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <PortfolioModeToggle mode={mode} onChange={handleModeChange} />
          <span className="text-xs text-slate-500">
            {mode === "backtest"
              ? `Simulasi${dateRef ? ` · ${dateRef}` : ""}`
              : "Data pasar terkini"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {mode === "backtest" && (
            <div className="space-y-1">
              <Label
                htmlFor="backtest-end-date"
                className="text-xs font-medium text-slate-600"
              >
                Performa sampai
              </Label>
              <Input
                id="backtest-end-date"
                type="date"
                value={endDate}
                min={minEndDate}
                max={BACKTEST_DATA_MAX}
                aria-invalid={!isEndDateValid}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-44 bg-card"
              />
              {!isEndDateValid && (
                <p className="text-xs text-red-600">
                  Pilih {minEndDate}–{BACKTEST_DATA_MAX}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-800">
          <Activity className="w-5 h-5 shrink-0 animate-spin" />
          <p className="text-sm">Memuat portofolio dari server...</p>
        </div>
      )}

      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{fetchError}</p>
        </div>
      )}

      {/* Mode backtest aktif tetapi belum ada portofolio simulasi tersimpan */}
      {mode === "backtest" && !portfolio && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <FlaskConical className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">
              Belum ada portofolio simulasi backtest
            </p>
            <p className="mt-1">
              Jalankan <strong>Rekomendasi Baru</strong> dalam mode Backtest
              untuk membuat portofolio simulasi
              {dateRef ? ` per ${dateRef}` : ""}. Portofolio live Anda tidak
              akan berubah.
            </p>
            <Link to="/generate" state={{ mode: "backtest" }}>
              <Button
                size="sm"
                className="mt-3 bg-amber-600 hover:bg-amber-700 h-8"
              >
                <FlaskConical className="w-4 h-4 mr-1.5" />
                Jalankan Simulasi Backtest
              </Button>
            </Link>
          </div>
        </div>
      )}

      {portfolio && selectedSeries && (
        <section
          className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5"
          aria-label="Riwayat rebalance portofolio"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Riwayat rebalance
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Portofolio awal dan setiap rebalance menampilkan periodenya
                sendiri. Pilih Keseluruhan untuk melihat semua periode.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {selectedSeries.snapshots.length - 1} rebalance
            </span>
          </div>
          <div
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="Pilih snapshot portofolio"
          >
            <button
              type="button"
              aria-pressed={performanceScope === "overall"}
              onClick={() => {
                setPerformanceView({ key: location.key, scope: "overall" });
                const latest = selectedSeries.latest;
                setPortfolio(latest);
                if (mode === "backtest") {
                  const latestDate = latest.date_ref?.slice(0, 10) ?? null;
                  setDateRef(latestDate);
                  if (latestDate) setRebalanceStartDate(latestDate);
                }
              }}
              className={`min-w-36 shrink-0 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${performanceScope === "overall" ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40"}`}
            >
              <span className="block text-xs font-semibold">Keseluruhan</span>
              <span className="mt-0.5 block text-xs opacity-75">
                Awal hingga data terakhir
              </span>
            </button>
            {selectedSeries.snapshots.map((snapshot, index) => (
              <button
                key={snapshot.id}
                type="button"
                aria-pressed={
                  performanceScope === "period" && portfolio.id === snapshot.id
                }
                onClick={() => {
                  setPerformanceView({ key: location.key, scope: "period" });
                  setPortfolio(snapshot);
                  if (mode === "backtest") {
                    const snapshotDate =
                      snapshot.date_ref?.slice(0, 10) ?? null;
                    setDateRef(snapshotDate);
                    if (snapshotDate) setRebalanceStartDate(snapshotDate);
                  }
                }}
                className={`min-w-36 shrink-0 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${performanceScope === "period" && portfolio.id === snapshot.id ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40"}`}
              >
                <span className="block text-xs font-semibold">
                  {index === 0 ? "Portofolio awal" : `Rebalance ${index}`}
                </span>
                <span className="mt-0.5 block text-xs opacity-75">
                  {(mode === "backtest"
                    ? snapshot.execution_date || snapshot.date_ref
                    : snapshot.created_at
                  )?.slice(0, 10) ?? "Tanggal tidak tersedia"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {portfolio && snapshotHistoryError && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        >
          Riwayat rebalance belum dapat dimuat. Data portofolio saat ini tetap
          tersedia.
        </p>
      )}

      {mode === "live" && portfolio?.status_portofolio === "active" && (
        <details className="group rounded-2xl border border-slate-200 bg-card px-4 py-3 sm:px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Kelola modal & rebalance
                </p>
                <p className="text-xs text-slate-500">
                  Setor dana atau sesuaikan alokasi live
                  {(portfolio.pending_deposit ?? 0) > 0
                    ? ` · ${formattedRupiah(portfolio.pending_deposit ?? 0)} menunggu`
                    : ""}
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-4">
            <Card className="overflow-hidden border-primary/20 shadow-sm">
              <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Kelola modal · Live
                    </p>
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                      <span className="rounded-xl bg-primary p-2 text-primary-foreground">
                        <Plus className="h-4 w-4" />
                      </span>
                      Tambah Dana Portofolio
                    </CardTitle>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary">
                    Aktif
                  </span>
                </div>
                <CardDescription className="max-w-2xl pt-1 leading-relaxed">
                  Catat setoran sekarang. Dana baru akan masuk ke kas dan
                  perhitungan NAV ketika rebalance live dijalankan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-xs font-medium text-slate-600">
                      Menunggu rebalance
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-primary">
                      {formattedRupiah(portfolio.pending_deposit ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Belum termasuk NAV saat ini
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-600">
                      Kas portofolio saat ini
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                      {formattedRupiah(portfolio.sisa_budget)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dana yang sudah tersedia
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1 space-y-2 sm:min-w-64">
                      <Label
                        htmlFor="live-deposit-amount"
                        className="text-sm font-medium"
                      >
                        Nominal setoran baru
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                          Rp
                        </span>
                        <RupiahInput
                          id="live-deposit-amount"
                          aria-label="Nominal setoran baru dalam rupiah"
                          placeholder="Contoh: 1.500.000,50"
                          className="h-11 pl-10 text-base font-medium tabular-nums md:text-base"
                          value={liveDepositAmountInput}
                          disabled={isSavingDeposit || isRunningRebalance}
                          onValueChange={setLiveDepositAmountInput}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="h-11 gap-2 px-5"
                      onClick={addLiveCapital}
                      disabled={
                        isSavingDeposit ||
                        isRunningRebalance ||
                        !Number.isFinite(liveDepositAmount) ||
                        liveDepositAmount <= 0
                      }
                    >
                      <Plus className="h-4 w-4" />{" "}
                      {isSavingDeposit ? "Menyimpan..." : "Catat Setoran"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Gunakan titik untuk ribuan dan koma untuk desimal. Contoh:
                    1.500.000,50.
                  </p>
                </div>

                {depositMessage && (
                  <p
                    role={depositFailed ? "alert" : "status"}
                    className={`rounded-xl border px-4 py-3 text-sm ${depositFailed ? "border-red-200 bg-red-50 text-red-700" : "border-primary/20 bg-primary/5 text-primary"}`}
                  >
                    {depositMessage}
                  </p>
                )}
                {rebalanceError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {rebalanceError}
                  </p>
                )}
                {rebalanceSummary && (
                  <p
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                  >
                    {rebalanceSummary}
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-lg text-xs leading-relaxed text-slate-500">
                    Rebalance dapat mengubah alokasi saham. Setoran yang
                    menunggu akan dipakai sebagai kas baru pada proses ini.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 gap-2"
                    onClick={runLiveRebalance}
                    disabled={
                      isRunningRebalance || isSavingDeposit || isPreviewingBear
                    }
                  >
                    <Repeat className="h-4 w-4" />
                    {isRunningRebalance
                      ? "Menjalankan Rebalance..."
                      : isPreviewingBear
                        ? "Memeriksa pasar..."
                        : "Jalankan Rebalance Live"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </details>
      )}

      {/* ===== Rebalance series (khusus mode backtest) ===== */}
      {mode === "backtest" &&
        portfolio?.status_portofolio === "active_backtest" && (
          <details className="group rounded-2xl border border-slate-200 bg-card px-4 py-3 sm:px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Repeat className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Atur rebalance backtest
                  </p>
                  <p className="text-xs text-slate-500">
                    Jadwal rebalance dan setoran berkala
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-4">
              <Card className="overflow-hidden border-primary/20 shadow-sm">
                <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Simulasi historis
                      </p>
                      <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                        <span className="rounded-xl bg-primary p-2 text-primary-foreground">
                          <Repeat className="h-4 w-4" />
                        </span>
                        Rebalance Berkala
                      </CardTitle>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary">
                      Backtest
                    </span>
                  </div>
                  <CardDescription className="max-w-2xl pt-1 leading-relaxed">
                    Atur jadwal rebalance dan setoran berkala secara terpisah.
                    Simulasi ini tidak mengubah portofolio live.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        1
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Periode & jadwal rebalance
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor="rebalance-start-date"
                          className="text-xs font-medium text-slate-600"
                        >
                          Tanggal Mulai
                        </Label>
                        <Input
                          id="rebalance-start-date"
                          type="date"
                          min={BACKTEST_DATA_MIN}
                          max={BACKTEST_DATA_MAX}
                          value={rebalanceStartDate}
                          disabled={isRunningRebalance}
                          onChange={(e) =>
                            setRebalanceStartDate(e.target.value)
                          }
                          className="h-10 bg-card"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="rebalance-end-date"
                          className="text-xs font-medium text-slate-600"
                        >
                          Tanggal Akhir
                        </Label>
                        <Input
                          id="rebalance-end-date"
                          type="date"
                          min={rebalanceStartDate || BACKTEST_DATA_MIN}
                          max={BACKTEST_DATA_MAX}
                          value={rebalanceEndDate}
                          disabled={isRunningRebalance}
                          onChange={(e) => setRebalanceEndDate(e.target.value)}
                          className="h-10 bg-card"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="rebalance-interval"
                          className="text-xs font-medium text-slate-600"
                        >
                          Rebalance Setiap (bulan)
                        </Label>
                        <Input
                          id="rebalance-interval"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={12}
                          value={rebalanceIntervalMonths}
                          disabled={isRunningRebalance}
                          aria-invalid={!rebalanceIntervalValid}
                          onChange={(e) =>
                            setRebalanceIntervalMonths(
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                            )
                          }
                          className="h-10 bg-card"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        2
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Setoran tambahan{" "}
                        <span className="font-normal text-slate-500">
                          (opsional)
                        </span>
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="contribution-amount"
                          className="text-xs font-medium text-slate-600"
                        >
                          Nominal setiap setoran
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                            Rp
                          </span>
                          <RupiahInput
                            id="contribution-amount"
                            placeholder="Contoh: 1.000.000"
                            value={contributionAmountInput}
                            disabled={isRunningRebalance}
                            onValueChange={setContributionAmountInput}
                            className="h-10 bg-card pl-10 font-medium tabular-nums"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="contribution-interval"
                          className="text-xs font-medium text-slate-600"
                        >
                          Setor Setiap (bulan)
                        </Label>
                        <Input
                          id="contribution-interval"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={12}
                          value={contributionIntervalMonths}
                          disabled={
                            isRunningRebalance || contributionAmount <= 0
                          }
                          onChange={(event) =>
                            setContributionIntervalMonths(
                              Number(event.target.value),
                            )
                          }
                          className="h-10 bg-card"
                        />
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Contoh: setor Rp1.000.000 setiap 1 bulan. Setoran pertama
                      jatuh tempo setelah interval dari tanggal mulai; dana yang
                      terkumpul digunakan pada rebalance berikutnya.
                    </p>
                  </div>

                  {!rebalanceDateRangeValid && (
                    <p className="text-xs text-red-600">
                      Pilih rentang tanggal valid antara {BACKTEST_DATA_MIN} dan{" "}
                      {BACKTEST_DATA_MAX}; tanggal akhir tidak boleh lebih awal
                      dari tanggal mulai.
                    </p>
                  )}
                  {!rebalanceIntervalValid && (
                    <p className="text-xs text-red-600">
                      Interval harus berupa bilangan bulat antara 1 dan 12
                      bulan.
                    </p>
                  )}
                  {!contributionValid && (
                    <p className="text-xs text-red-600">
                      Setoran harus nol atau lebih; interval setoran 1–12 bulan.
                    </p>
                  )}

                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        3
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Tinjau simulasi
                      </h3>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Modal awal</p>
                        <p className="mt-1 font-semibold tabular-nums text-slate-900">
                          {formattedRupiah(
                            effectivePerformance?.initial_capital ??
                              portfolio.budget,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          Setoran berkala
                        </p>
                        <p className="mt-1 font-semibold tabular-nums text-slate-900">
                          {contributionAmount > 0
                            ? `${formattedRupiah(contributionAmount)} / ${contributionIntervalMonths} bulan`
                            : "Tidak ada"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Profil risiko</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {portfolio.risk_profile}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-slate-600">
                      GA dijalankan untuk setiap periode rebalance. Proses
                      mungkin memakan waktu beberapa menit.
                    </p>
                  </div>

                  {rebalanceError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                      <strong>Rebalance gagal:</strong> {rebalanceError}
                    </div>
                  )}
                  {rebalanceSummary && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
                      <strong>Rebalance series selesai.</strong>{" "}
                      {rebalanceSummary}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      className="h-10 gap-2"
                      onClick={runRebalanceSeries}
                      disabled={
                        isRunningRebalance ||
                        isPreviewingBear ||
                        !rebalanceIntervalValid ||
                        !rebalanceDateRangeValid ||
                        !contributionValid
                      }
                    >
                      {isRunningRebalance ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin" />{" "}
                          Menjalankan Rebalance...
                        </>
                      ) : isPreviewingBear ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin" />{" "}
                          Memeriksa pasar...
                        </>
                      ) : (
                        <>
                          <Repeat className="w-4 h-4" /> Jalankan Rebalance
                          Series
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-slate-500">
                      Hasil terakhir akan langsung ditampilkan di halaman ini.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </details>
        )}

      {isMock && mode === "live" && !fetchError && !isLoading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-card px-6 py-12 text-center">
          <Briefcase className="mx-auto mb-3 h-7 w-7 text-primary" />
          <h2 className="font-semibold text-slate-900">
            Belum ada portofolio live
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Buat rekomendasi untuk mulai memantau investasi Anda.
          </p>
          <Link to="/generate" state={{ mode: "live" }}>
            <Button className="mt-5">Buat Rekomendasi</Button>
          </Link>
        </div>
      )}

      {portfolio && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-primary/20 bg-primary/5 shadow-sm md:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-600">
                  {performanceWindow?.isSegment
                    ? "Nilai akhir periode"
                    : "Nilai portofolio"}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {displayPerformance?.final_nav != null
                    ? formattedRupiah(displayPerformance.final_nav)
                    : performanceWindow?.isSegment
                      ? "Belum tersedia"
                      : formattedRupiah(portfolio?.budget ?? budget)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {performanceWindow?.isSegment
                    ? "Nilai awal periode"
                    : "Modal awal"}{" "}
                  {displayPerformance?.initial_capital != null
                    ? formattedRupiah(displayPerformance.initial_capital)
                    : performanceWindow?.isSegment
                      ? "—"
                      : formattedRupiah(budget)}
                  {(displayPerformance?.total_contributions ?? 0) > 0
                    ? ` · Setoran ${formattedRupiah(displayPerformance?.total_contributions ?? 0)}`
                    : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-600">
                  {performanceWindow?.isSegment
                    ? "Hasil periode"
                    : "Hasil investasi"}
                </p>
                <p
                  className={`mt-2 text-2xl font-semibold tabular-nums ${totalPnl == null ? "text-slate-400" : totalPnl >= 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {totalPnl == null
                    ? "Belum tersedia"
                    : `${totalPnl >= 0 ? "+" : "−"}${formattedRupiah(Math.abs(totalPnl))}`}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {displayPerformance?.total_return_pct != null
                    ? `Return ${displayPerformance.total_return_pct.toFixed(2)}% · tidak termasuk setoran`
                    : "Menunggu data harga terbaru"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-600">
                  Profil risiko
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {riskProfile}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {portfolio?.n_active ?? holdings.length} saham
                  {displayPerformance
                    ? ` · Data s.d. ${displayPerformance.end_date.slice(0, 10)}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pie Chart & Allocation */}
            <Card className="order-2 border-slate-200 shadow-sm lg:order-1 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Alokasi Saham</CardTitle>
                <CardDescription>
                  {performanceScope === "overall"
                    ? "Komposisi saham pada snapshot terakhir"
                    : "Proporsi saham pada periode yang dipilih"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={holdings}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {holdings.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value) => `${Number(value).toFixed(2)}%`}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Historical Performance (hanya mode demo) / Ringkasan GA (data asli) */}
            {portfolio ? (
              <Card className="order-1 border-slate-200 shadow-sm lg:order-2 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Performa</CardTitle>
                  <CardDescription>
                    {performanceWindow?.isSegment
                      ? portfolio.id === selectedSeries?.root.id
                        ? "Periode portofolio awal"
                        : "Periode rebalance"
                      : "Keseluruhan portofolio"}{" "}
                    dibandingkan dengan IHSG ·{" "}
                    {displayPerformance?.start_date?.slice(0, 10) ?? "—"}–
                    {displayPerformance?.end_date?.slice(0, 10) ?? "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {displayPerformance?.final_nav != null && (
                    <p className="mb-4 text-xs text-slate-500">
                      Saham{" "}
                      {latestPerformancePoint?.holdings_market_value != null
                        ? formattedRupiah(
                            latestPerformancePoint.holdings_market_value,
                          )
                        : "—"}
                      {" · "}Kas{" "}
                      {latestPerformancePoint?.cash_balance != null
                        ? formattedRupiah(latestPerformancePoint.cash_balance)
                        : "—"}
                    </p>
                  )}
                  {hasPerformanceData ? (
                    <div className="h-[280px] w-full">
                      <PerformanceChart
                        data={performanceChartData}
                        portfolioLineColor={portfolioLineColor}
                      />
                    </div>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center bg-amber-50/50 border border-amber-200 rounded-xl">
                      <div className="text-center px-6">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                        <p className="text-sm font-medium text-amber-800 mb-1">
                          Data performa belum tersedia
                        </p>
                        <p className="text-xs text-amber-700">
                          {performanceError
                            ? `Endpoint performance gagal: ${performanceError}`
                            : "Data harga belum cukup untuk menampilkan grafik."}
                        </p>
                      </div>
                    </div>
                  )}
                  {displayPerformance && (
                    <div className="mt-4 space-y-2 text-xs">
                      {performanceWindow?.isSegment &&
                        performanceWindow.nextExecutionDate && (
                          <p className="text-slate-600">
                            Periode ini berakhir sebelum rebalance berikutnya
                            pada {performanceWindow.nextExecutionDate}.
                          </p>
                        )}
                      {displayPerformance.start_date_adjusted && (
                        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                          Perhitungan dimulai pada{" "}
                          {displayPerformance.start_date.slice(0, 10)} karena
                          tanggal portofolio yang diminta (
                          {displayPerformance.requested_start_date.slice(0, 10)}
                          ) bukan hari harga yang tersedia.
                        </p>
                      )}
                      {displayPerformance.missing_price_tickers.length > 0 && (
                        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                          Harga tidak tersedia untuk:{" "}
                          {displayPerformance.missing_price_tickers.join(", ")}.
                        </p>
                      )}
                      {displayPerformance.accounting_limitations.length > 0 && (
                        <details className="text-slate-500">
                          <summary className="cursor-pointer">
                            Catatan perhitungan performa
                          </summary>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {displayPerformance.accounting_limitations.map(
                              (limitation) => (
                                <li key={limitation}>{limitation}</li>
                              ),
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:col-span-2 shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Performa Historis: IHSG vs Portofolio
                  </CardTitle>
                  <CardDescription>
                    Simulasi backtesting pertumbuhan kumulatif
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={mockHistoricalData}
                        margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e7e0d3"
                        />
                        <XAxis
                          dataKey="year"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#8c8f85" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#8c8f85" }}
                          dx={-10}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <RechartsTooltip
                          cursor={{
                            stroke: "#d8d0bf",
                            strokeWidth: 1,
                            strokeDasharray: "4 4",
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          wrapperStyle={{ paddingBottom: "20px" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="portfolio"
                          name="Portofolio GA"
                          stroke="#117a58"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ihsg"
                          name="IHSG"
                          stroke="#e0a83a"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Detailed Holding Table */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-slate-500" /> Saham yang
                    Dimiliki
                  </CardTitle>
                  <CardDescription>
                    Harga per lembar dalam rupiah
                    {mode === "backtest" && dateRef
                      ? ` · acuan ${dateRef}`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[110px] whitespace-nowrap">
                          Saham
                        </TableHead>
                        {/* Harga pasar harian hanya bermakna di mode live */}
                        {mode === "live" && (
                          <TableHead className="whitespace-nowrap">
                            Harga pasar
                          </TableHead>
                        )}
                        <TableHead className="whitespace-nowrap">
                          Harga acuan
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          Harga beli
                        </TableHead>
                        <TableHead className="whitespace-nowrap">Lot</TableHead>
                        <TableHead className="text-right whitespace-nowrap">
                          Nilai
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((item) => {
                        const acuan = hargaAcuanPerLembar(item);
                        const isEditing = editingTicker === item.name;
                        const isSaving = savingTicker === item.name;
                        const canEdit =
                          mode === "live" && !isMock && !!item.itemId;
                        return (
                          <TableRow key={item.name}>
                            <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                              {item.name}
                            </TableCell>
                            {mode === "live" && (
                              <TableCell className="text-slate-600 whitespace-nowrap">
                                Rp{" "}
                                {formatRupiahAngka(
                                  getMarketPrice(item.name, acuan),
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-slate-600 whitespace-nowrap">
                              Rp {formatRupiahAngka(acuan)}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      autoFocus
                                      aria-invalid={!!editError}
                                      value={
                                        editValue
                                          ? new Intl.NumberFormat(
                                              "id-ID",
                                            ).format(
                                              Number(
                                                editValue.replace(/\D/g, "") ||
                                                  0,
                                              ),
                                            )
                                          : ""
                                      }
                                      onChange={(e) => {
                                        setEditValue(
                                          e.target.value.replace(/\D/g, ""),
                                        );
                                        if (editError) setEditError(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEdit(item);
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                      className={`h-9 w-32 bg-card ${
                                        editError
                                          ? "border-red-400 focus-visible:ring-red-300"
                                          : ""
                                      }`}
                                      disabled={isSaving}
                                    />
                                    <Button
                                      size="icon"
                                      onClick={() => saveEdit(item)}
                                      disabled={isSaving || !editValue}
                                      className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700"
                                    >
                                      {isSaving ? (
                                        <Activity className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Check className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={cancelEdit}
                                      disabled={isSaving}
                                      className="h-9 w-9"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  {editError && (
                                    <p className="text-xs text-red-600 max-w-[220px]">
                                      {editError}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600">
                                    Rp{" "}
                                    {formatRupiahAngka(hargaBeliTerpakai(item))}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => startEdit(item)}
                                    disabled={!canEdit}
                                    title={
                                      canEdit
                                        ? "Edit harga beli"
                                        : mode === "backtest"
                                          ? "Harga beli hanya bisa diubah pada portofolio live"
                                          : isMock
                                            ? "Edit hanya tersedia saat portofolio tersimpan di server"
                                            : "item_id tidak tersedia dari backend"
                                    }
                                    className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                              {item.lot} Lot
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap">
                              Rp {item.total.toLocaleString("id-ID")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Rincian Rebalance (hanya bila portofolio dibuat dengan rebalance) */}
              {portfolio?.rebalance_deltas &&
                portfolio.rebalance_deltas.length > 0 && (
                  <details className="rounded-2xl border border-slate-200 bg-card px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      Perubahan pada rebalance terakhir ·{" "}
                      {portfolio.rebalance_deltas.length} saham
                    </summary>
                    <div className="pt-3">
                      <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Repeat className="w-5 h-5 text-slate-500" />{" "}
                            Rincian Rebalance
                          </CardTitle>
                          <CardDescription>
                            Perubahan posisi (Buy/Sell/Hold) hasil rebalance
                            terakhir
                            {mode === "backtest" && dateRef
                              ? ` — simulasi per ${dateRef}`
                              : ""}
                            . Kurva performa di halaman ini sudah
                            memperhitungkan hasil rebalance.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="whitespace-nowrap">
                                  Kode Emiten
                                </TableHead>
                                <TableHead className="whitespace-nowrap">
                                  Aksi
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  Lot Lama
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  Lot Baru
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  Selisih Lot
                                </TableHead>
                                <TableHead className="whitespace-nowrap">
                                  Alasan
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {portfolio.rebalance_deltas.map((delta) => (
                                <TableRow key={delta.kode}>
                                  <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                                    {delta.kode}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <RebalanceActionBadge
                                      action={delta.action}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right text-slate-600 whitespace-nowrap">
                                    {delta.old_lot} Lot
                                  </TableCell>
                                  <TableCell className="text-right text-slate-600 whitespace-nowrap">
                                    {delta.new_lot} Lot
                                  </TableCell>
                                  <TableCell
                                    className={`text-right font-semibold whitespace-nowrap ${
                                      delta.action === "BUY"
                                        ? "text-emerald-600"
                                        : delta.action === "SELL"
                                          ? "text-red-600"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {delta.action === "BUY"
                                      ? "+"
                                      : delta.action === "SELL"
                                        ? "-"
                                        : ""}
                                    {delta.delta_lot} Lot
                                  </TableCell>
                                  <TableCell className="text-slate-600 text-sm">
                                    {delta.reason}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  </details>
                )}

              {/* Fitness Metrics */}
              <details className="rounded-2xl border border-slate-200 bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Metrik analisis lanjutan
                </summary>
                <div className="pt-3">
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-500" />{" "}
                        Ringkasan & Komponen Evaluasi (GA)
                      </CardTitle>
                      <CardDescription>
                        Hasil Algoritma Genetika untuk profil risiko{" "}
                        {riskProfile}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Dana Terpakai
                          </div>
                          <div className="text-2xl font-bold text-slate-900">
                            {portfolio
                              ? formattedRupiah(portfolio.total_terpakai)
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Sisa Budget (Cash)
                          </div>
                          <div className="text-2xl font-bold text-blue-700">
                            {portfolio
                              ? formattedRupiah(portfolio.sisa_budget)
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Fitness Score
                          </div>
                          <div className="text-2xl font-bold text-slate-900">
                            {portfolio
                              ? portfolio.fitness_score.toFixed(2)
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Sharpe Ratio
                          </div>
                          <div className="text-2xl font-bold text-slate-900">
                            {portfolio
                              ? portfolio.sharpe_ratio.toFixed(2)
                              : "1.05"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Expected Return
                          </div>
                          <div className="text-2xl font-bold text-emerald-600">
                            {portfolio?.expected_return != null
                              ? `${(portfolio.expected_return * 100).toFixed(2)}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Max Drawdown
                          </div>
                          <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            {portfolio?.max_drawdown != null
                              ? `${(portfolio.max_drawdown * 100).toFixed(2)}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Avg Korelasi
                          </div>
                          <div className="text-2xl font-bold text-slate-900">
                            {portfolio
                              ? portfolio.avg_correlation.toFixed(2)
                              : "0.40"}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Skor Fundamental
                          </div>
                          <div className="text-2xl font-bold text-emerald-600 flex items-baseline gap-1">
                            {portfolio
                              ? portfolio.skor_fundamental.toFixed(2)
                              : "0.95"}{" "}
                            <span className="text-xs text-slate-400 font-normal">
                              / 1.0
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Penalti Modal
                          </div>
                          <div
                            className={`text-2xl font-bold flex items-center gap-2 ${
                              budgetOk ? "text-slate-900" : "text-red-600"
                            }`}
                          >
                            {budgetOk ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                Lolos
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                Tidak Lolos
                              </>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="text-sm font-medium text-slate-500 mb-1">
                            Penalti Diversifikasi
                          </div>
                          <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />{" "}
                            {portfolio
                              ? `${portfolio.n_active} Saham Aktif`
                              : "Lolos"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </details>
            </div>

            {/* LLM Narration */}
            <div className="lg:col-span-1">
              <details className="rounded-2xl border border-slate-200 bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Penjelasan strategi
                </summary>
                <div className="pt-3">
                  <Card className="shadow-md border-0 bg-gradient-to-b from-blue-50/50 to-white relative overflow-hidden h-full">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                      <Bot className="w-48 h-48 text-blue-900" />
                    </div>
                    <CardHeader className="relative z-10 pb-4">
                      <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                        <Bot className="w-6 h-6 text-blue-700" />
                      </div>
                      <CardTitle className="text-xl text-slate-900">
                        Interpretasi Strategi AI
                      </CardTitle>
                      <CardDescription className="text-slate-600 text-base">
                        Rasionalisasi dari Large Language Model (Gemini)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="space-y-4">
                        {portfolio ? (
                          <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-line">
                            {portfolio.narasi_llm}
                          </p>
                        ) : (
                          <>
                            <p className="text-slate-700 leading-relaxed text-[15px]">
                              Alokasi{" "}
                              <strong className="text-slate-900">
                                {riskProfile?.toLowerCase()}
                              </strong>{" "}
                              ini dirancang berfokus pada perlindungan modal
                              secara substansial. Algoritma melakukan seleksi
                              ketat dan memilih tiga emiten raksasa (BBCA, ICBP,
                              TLKM) yang memiliki fundamental bisnis sangat
                              solid (Skor 0.95).
                            </p>
                            <p className="text-slate-700 leading-relaxed text-[15px]">
                              Dari sudut pandang matematis, portofolio ini
                              mencatatkan tingkat korelasi rendah (0.40). Hal
                              ini sangat krusial untuk mencegah penurunan
                              serentak jika pasar sedang terkoreksi.
                            </p>
                            <p className="text-slate-700 leading-relaxed text-[15px]">
                              Ditopang rasio imbal hasil terhadap risiko yang
                              optimal <em>(Sharpe Ratio 1.05)</em>, mesin
                              berhasil mengunci potensi kejatuhan terdalam{" "}
                              <em>(Max Drawdown)</em> di angka aman 9%, sangat
                              sesuai dengan batas toleransi risiko Anda.
                            </p>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </details>
            </div>
          </div>
        </>
      )}
      {liveBearPreview && (
        <BearMarketDialog
          assessments={[liveBearPreview]}
          initialPolicy={bearPolicy}
          capital={displayPerformance?.final_nav ?? portfolio?.budget}
          busy={isRunningRebalance}
          error={rebalanceError}
          onClose={() => {
            setLiveBearPreview(null);
            setRebalanceError(null);
          }}
          onConfirm={confirmLiveRebalance}
        />
      )}
      {seriesBearPreview && (
        <BearMarketDialog
          assessments={seriesBearPreview}
          initialPolicy={bearPolicy}
          capital={effectivePerformance?.initial_capital ?? portfolio?.budget}
          busy={isRunningRebalance}
          error={rebalanceError}
          onClose={() => {
            setSeriesBearPreview(null);
            setRebalanceError(null);
          }}
          onConfirm={confirmRebalanceSeries}
        />
      )}
    </div>
  );
}
