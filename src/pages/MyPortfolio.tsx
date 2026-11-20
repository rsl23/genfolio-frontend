import { portfolioManagementTarget } from "@/lib/portfolioManagement";
import { memo, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
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
import { formatRupiahInput, parseRupiahInput } from "@/lib/rupiahInput";
import { groupPortfolioSeries } from "@/lib/portfolioSeries";
import { selectPerformanceWindow } from "@/lib/portfolioPerformanceWindow";
import { performanceReturnMetrics } from "@/lib/portfolioReturnMetrics";
import PortfolioReturnSummary from "@/components/PortfolioReturnSummary";
import RiskEvaluationPanel from "@/components/RiskEvaluationPanel";
import PortfolioNewsContext from "@/components/PortfolioNewsContext";
import { Label } from "@/components/ui/label";
import BearMarketDialog from "@/components/BearMarketDialog";
import PortfolioProgressDialog from "@/components/PortfolioProgressDialog";
import MarketPreviewStatus from "@/components/MarketPreviewStatus";
import { usePortfolioProgress } from "@/hooks/usePortfolioProgress";
import { isBearPreviewChanged, BEAR_PREVIEW_UPDATED } from "@/lib/bearPreview";
import { executionOptions } from "@/lib/portfolioExecutionPolicy";
import type { FitnessPolicy } from "@/types";
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
  addMonthsIso,
  defaultBacktestEndDate,
  getBacktestDateRef,
  getPortfolioMode,
  getTodayIsoDate,
  setBacktestDateRef,
  setCachedPortfolio,
  setPortfolioMode,
} from "@/lib/portfolioMode";

function portfolioActionError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    // The backend exception handler wraps HTTPException.detail in message.
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
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
          name="TWR Portofolio (%)"
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
  const analysis = usePortfolioProgress();
  const location = useLocation();
  const navigate = useNavigate();
  const { portfolioId } = useParams<{ portfolioId: string }>();
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

  // Mode awal dari navigasi atau preferensi; ID di URL menentukan portofolio.
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

  // Detail hanya menampilkan portofolio yang dipilih di URL.
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
  const [editLots, setEditLots] = useState("");
  const [holdingsRevision, setHoldingsRevision] = useState(0);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingTicker, setSavingTicker] = useState<string | null>(null);
  // Map item_id -> koreksi harga beli yang baru disimpan, khusus snapshot itu.
  const [hargaBeliMap, setHargaBeliMap] = useState<Record<string, number>>({});
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityName, setIdentityName] = useState("");
  const [identityDescription, setIdentityDescription] = useState("");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  // ===== Rebalance series (khusus backtest) =====
  // Rebalance berantai melanjutkan snapshot tersimpan tanpa GA awal lagi.
  const [rebalanceEndDate, setRebalanceEndDate] = useState(() =>
    defaultBacktestEndDate(),
  );
  const [rebalanceIntervalMonths, setRebalanceIntervalMonths] = useState(3);
  const [guardedRebalance, setGuardedRebalance] = useState(false);
  const [fitnessPolicy] =
    useState<FitnessPolicy>("legacy_cvar_v1");
  useEffect(() => {
    setGuardedRebalance(
      portfolio?.rebalance_diagnostics?.model === "guarded_v1",
    );
  }, [portfolio?.id, portfolio?.rebalance_diagnostics?.model]);
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
  const seriesName = (() => {
    if (!selectedSeries) return portfolio?.name_portofolio || "Portofolio Saya";
    const latest = selectedSeries.latest;
    const latestDay = (latest.execution_date || latest.date_ref || latest.created_at).slice(0, 10);
    const generatedLatest = `Portofolio ${latest.risk_profile} ${latestDay}`;
    if (!selectedSeries.root.name_portofolio && latest.name_portofolio === generatedLatest) {
      const root = selectedSeries.root;
      const rootDay = (root.execution_date || root.date_ref || root.created_at).slice(0, 10);
      return `Portofolio ${root.risk_profile} ${rootDay}`;
    }
    return latest.name_portofolio || portfolio?.name_portofolio || "Portofolio Saya";
  })();
  const managementPortfolio = portfolioManagementTarget(
    portfolio,
    selectedSeries,
    mode,
  );
  const liveManagementPortfolio = mode === "live" ? managementPortfolio : null;
  const performancePortfolioId =
    selectedSeries?.latest.id ?? (snapshotHistoryError ? portfolio?.id : null);
  const performanceRequestKey = performancePortfolioId
    ? `${mode}:${performancePortfolioId}:${mode === "backtest" ? endDate : "latest"}:${holdingsRevision}`
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
  const returnMetrics = useMemo(
    () =>
      displayPerformance ? performanceReturnMetrics(displayPerformance) : null,
    [displayPerformance],
  );

  useEffect(() => {
    let cancelled = false;
    void portofolioService
      .getAllMyPortofolios(mode === "backtest")
      .then((response) => {
        if (cancelled) return;
        if (response.status === "success" && Array.isArray(response.data)) {
          setAllSnapshots(response.data);
          setSnapshotHistoryError(false);
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

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      setIsLoading(true);
      setFetchError(null);
      setPortfolio(null);
      setMarketData(null);
      try {
        const modes: PortfolioMode[] = [
          mode,
          mode === "live" ? "backtest" : "live",
        ];
        let selected: PortfolioData | null = null;
        let selectedMode = mode;
        let snapshots: PortfolioData[] = [];
        let requestFailed = false;

        for (const candidate of modes) {
          const result = await settle(
            portofolioService.getAllMyPortofolios(candidate === "backtest"),
          );
          if (cancelled) return;
          if (
            result.status !== "fulfilled" ||
            result.value.status !== "success" ||
            !Array.isArray(result.value.data)
          ) {
            requestFailed = true;
            continue;
          }
          const group = groupPortfolioSeries(result.value.data, candidate).find(
            (item) =>
              item.snapshots.some((snapshot) => snapshot.id === portfolioId),
          );
          if (!group) continue;
          selected =
            group.snapshots.find((snapshot) => snapshot.id === portfolioId) ??
            group.root;
          selectedMode = candidate;
          snapshots = result.value.data;
          break;
        }

        // Respons yang baru dibuat tetap dapat dibuka saat daftar gagal dimuat.
        const navigationPortfolio = state?.portfolio;
        if (
          !selected &&
          requestFailed &&
          navigationPortfolio &&
          navigationPortfolio.id === portfolioId &&
          isStatusForMode(
            navigationPortfolio.status_portofolio,
            state?.mode ?? mode,
          )
        ) {
          selected = navigationPortfolio;
          selectedMode = state?.mode ?? mode;
          snapshots = [navigationPortfolio];
          setSnapshotHistoryError(true);
        }

        if (!selected) {
          setFetchError(
            requestFailed
              ? "Portofolio belum dapat dimuat. Periksa koneksi dan kembali ke daftar."
              : "Portofolio ini tidak ditemukan di akun Anda.",
          );
          return;
        }

        setMode(selectedMode);
        setPortfolioMode(selectedMode);
        setAllSnapshots(snapshots);
        setPortfolio(selected);
        if (selectedMode === "backtest") {
          const selectedDate = selected.date_ref?.slice(0, 10) ?? null;
          setDateRef(selectedDate);
          setBacktestDateRef(selectedDate);
          return;
        }

        const marketRes = await settle(portofolioService.priceHistory());
        if (cancelled) return;
        setMarketData(
          marketRes.status === "fulfilled" && marketRes.value.data
            ? marketRes.value.data
            : null,
        );
      } catch (err) {
        console.error("Gagal mengambil portofolio:", err);
        if (!cancelled)
          setFetchError(
            "Portofolio belum dapat dimuat. Periksa koneksi dan kembali ke daftar.",
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPortfolio();
    return () => {
      cancelled = true;
    };
  }, [location.key, mode, portfolioId, state]);

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
            ? portfolioActionError(res.reason, "Performa portofolio belum tersedia.")
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
    holdingsRevision,
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
  const rebalanceBaseDate = (
    managementPortfolio?.date_ref ??
    managementPortfolio?.execution_date ??
    managementPortfolio?.created_at ??
    BACKTEST_DATA_MIN
  ).slice(0, 10);
  const minRebalanceEndDate = addMonthsIso(
    rebalanceBaseDate, rebalanceIntervalMonths,
  );
  const rebalanceDateRangeValid =
    rebalanceBaseDate >= BACKTEST_DATA_MIN &&
    minRebalanceEndDate <= BACKTEST_DATA_MAX &&
    rebalanceEndDate >= minRebalanceEndDate &&
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
      !liveManagementPortfolio ||
      !Number.isFinite(liveDepositAmount) ||
      liveDepositAmount <= 0
    )
      return;
    setIsSavingDeposit(true);
    setDepositMessage(null);
    setDepositFailed(false);
    try {
      const response = await portofolioService.addLiveCapital(
        liveDepositAmount,
        liveManagementPortfolio.id,
      );
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || "Setoran tidak berhasil dicatat.");
      }
      setAllSnapshots((snapshots) => [
        ...snapshots.filter((item) => item.id !== response.data.id),
        response.data,
      ]);
      if (portfolio?.id === response.data.id) setPortfolio(response.data);
      setCachedPortfolio("live", response.data);
      setHistoryRefreshToken((token) => token + 1);
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
    if (!liveManagementPortfolio) return;
    analysis.start(true);
    setIsPreviewingBear(true);
    setRebalanceError(null);
    setRebalanceSummary(null);
    try {
      const [policy, preview] = await Promise.all([
        portofolioService.getBearPolicy(),
        portofolioService.previewBearMarket({
          risk_profile: liveManagementPortfolio.risk_profile,
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
    if (!liveManagementPortfolio || !liveBearPreview) return;
    const signal = analysis.start();
    setIsRunningRebalance(true);
    setRebalanceError(null);
    try {
      if (policy !== bearPolicy) await portofolioService.setBearPolicy(policy);
      const response = await portofolioService.stockPortofolioGenerate({
        budget: liveManagementPortfolio.budget,
        risk_profile: liveManagementPortfolio.risk_profile,
        backtest: false,
        rebalance: true,
        rebalance_portfolio_id: liveManagementPortfolio.id,
        name_portofolio: liveManagementPortfolio.name_portofolio ?? undefined,
        description: liveManagementPortfolio.description ?? null,
        ...executionOptions(fitnessPolicy, guardedRebalance),
        bear_management: true,
        bear_choice: choices[liveBearPreview.requested_date],
        bear_preview_as_of: liveBearPreview.as_of,
        bear_preview_fingerprint: liveBearPreview.fingerprint,
      }, analysis.onProgress, signal);
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || "Rebalance live gagal.");
      }
      setAllSnapshots((snapshots) => [
        ...snapshots.filter((item) => item.id !== response.data.id),
        response.data,
      ]);
      setPortfolio(response.data);
      setCachedPortfolio("live", response.data);
      setDepositMessage(null);
      setHistoryRefreshToken((token) => token + 1);
      setRebalanceSummary(
        "Rebalance live selesai. Setoran yang menunggu sudah masuk perhitungan kas dan NAV.",
      );
      setLiveBearPreview(null);
    } catch (error) {
      if (signal.aborted) {
        setLiveBearPreview(null);
        setRebalanceSummary("Permintaan penghentian sudah dikirim. Periksa riwayat untuk melihat hasil yang sudah tersimpan.");
        setHistoryRefreshToken((token) => token + 1);
        return;
      }
      if (isBearPreviewChanged(error)) {
        try {
          const updated = await portofolioService.previewBearMarket({
            risk_profile: liveManagementPortfolio.risk_profile,
            backtest: false,
          });
          setBearPolicy(policy);
          setLiveBearPreview(updated);
          setRebalanceError(BEAR_PREVIEW_UPDATED);
        } catch (refreshError) {
          setLiveBearPreview(null);
          setRebalanceError(
            portfolioActionError(
              refreshError,
              "Gagal memuat ulang pratinjau pasar.",
            ),
          );
        }
      } else {
        setRebalanceError(
          portfolioActionError(error, "Gagal menjalankan rebalance live."),
        );
      }
    } finally {
      setIsRunningRebalance(false);
    }
  };

  const runRebalanceSeries = async () => {
    if (
      !managementPortfolio ||
      !rebalanceIntervalValid ||
      !rebalanceDateRangeValid ||
      !contributionValid
    ) {
      return;
    }

    analysis.start(true);
    setIsPreviewingBear(true);
    setRebalanceError(null);
    setRebalanceSummary(null);
    try {
      const [policy, preview] = await Promise.all([
        portofolioService.getBearPolicy(),
        portofolioService.previewBearSeries({
          base_portfolio_id: managementPortfolio.id,
          budget: managementPortfolio.budget,
          name_portofolio: managementPortfolio.name_portofolio ?? undefined,
          description: managementPortfolio.description ?? null,
          risk_profile: managementPortfolio.risk_profile,
          start_date: rebalanceBaseDate,
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
    rebalanceMethod?: "legacy" | "composition_v2",
  ) => {
    if (!managementPortfolio || !seriesBearPreview || !rebalanceDateRangeValid || !rebalanceMethod) return;
    const signal = analysis.start();
    setIsRunningRebalance(true);
    setRebalanceError(null);
    try {
      if (policy !== bearPolicy) await portofolioService.setBearPolicy(policy);
      const response = await portofolioService.generateRebalanceSeries({
        ...executionOptions(fitnessPolicy, rebalanceMethod === "legacy" && guardedRebalance),
        profile_policy: rebalanceMethod,
        base_portfolio_id: managementPortfolio.id,
        budget: managementPortfolio.budget,
        name_portofolio: managementPortfolio.name_portofolio ?? undefined,
        description: managementPortfolio.description ?? null,
        risk_profile: managementPortfolio.risk_profile,
        start_date: rebalanceBaseDate,
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
      }, analysis.onProgress, signal);

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
        setBacktestDateRef(latestDate);
      }
      setRebalanceSummary(
        `${response.data.scheduled_dates.length - response.data.skipped.length} rebalance berhasil dari ` +
          `${response.data.scheduled_dates.length} tanggal terjadwal` +
          ` dengan ${rebalanceMethod === "composition_v2" ? "Composition v2" : "Legacy CVaR"}` +
          (response.data.skipped.length
            ? `; ${response.data.skipped.length} tanggal dilewati. ` +
              response.data.skipped.slice(0, 3)
                .map((step) => `${step.date}: ${step.reason}`)
                .join(" ") +
              (response.data.skipped.length > 3 ? " Lihat log untuk tanggal lainnya." : "")
            : ".") +
          (response.data.evaluation_mode === "what_if"
            ? " Pilihan historis manual ini adalah simulasi what-if."
            : ""),
      );
      setSeriesBearPreview(null);
      const newRoot = response.data.portfolios[0];
      if (newRoot && newRoot.id !== portfolioId) {
        navigate(`/portfolio/${encodeURIComponent(newRoot.id)}`, {
          replace: true,
          state: {
            mode: "backtest",
            portfolio: newRoot,
            selectedPortfolioId: newRoot.id,
          },
        });
      }
    } catch (error) {
      if (signal.aborted) {
        setSeriesBearPreview(null);
        setRebalanceSummary("Permintaan penghentian sudah dikirim. Jadwal yang sudah selesai tetap tersimpan; periksa riwayat sebelum melanjutkan rebalance.");
        setHistoryRefreshToken((token) => token + 1);
        return;
      }
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
  const previousAllocations =
    mode === "live" && portfolio?.status_portofolio === "active"
      ? (allSnapshots.find(
          (snapshot) => snapshot.id === portfolio.parent_portofolio_id,
        )?.allocations ?? [])
      : [];
  const holdings = portfolio
    ? [
        ...portfolio.allocations,
        ...previousAllocations
          .filter(
            (old) =>
              old.lots > 0 &&
              !portfolio.allocations.some(
                (current) => current.ticker === old.ticker,
              ),
          )
          .map((old) => ({
            ...old,
            item_id: "",
            lots: 0,
            allocation: 0,
            weight: 0,
            price_per_lot:
              (portfolio.execution_prices?.[old.ticker] ??
                old.price_per_lot / 100) * 100,
          })),
      ].map((a) => ({
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
    value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

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
  const validateHargaBeli = (raw: string): number | null => {
    const hargaBeli = parseRupiahInput(raw);
    if (!raw.trim() || !Number.isFinite(hargaBeli) || hargaBeli <= 0) {
      setEditError("Masukkan harga beli per lembar yang lebih dari Rp 0.");
      return null;
    }
    setEditError(null);
    return hargaBeli;
  };

  const hargaAcuanPerLembar = (item: (typeof holdings)[number]) =>
    Number(item.price) / 100; // price_per_lot dari GA -> per lembar

  const hargaBeliTerpakai = (item: (typeof holdings)[number]) =>
    (item.itemId ? hargaBeliMap[item.itemId] : undefined) ??
    item.hargaBeli ??
    (portfolio ? null : hargaAcuanPerLembar(item));

  const startEdit = (item: (typeof holdings)[number]) => {
    setEditingTicker(item.name);
    setEditLots(item.lot.toLocaleString("id-ID"));
    setEditValue(
      formatRupiahInput(
        (hargaBeliTerpakai(item) ?? hargaAcuanPerLembar(item)).toLocaleString(
          "id-ID",
          {
            useGrouping: false,
            maximumFractionDigits: 2,
          },
        ),
      ),
    );
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingTicker(null);
    setEditValue("");
    setEditError(null);
  };

  const saveEdit = async (item: (typeof holdings)[number]) => {
    const hargaBeli = validateHargaBeli(editValue);
    const lots = parseRupiahInput(editLots);
    if (hargaBeli === null) return;
    if (
      !editLots.trim() ||
      !Number.isSafeInteger(lots) ||
      lots < 0 ||
      lots > 2147483647
    ) {
      setEditError("Jumlah lot harus bilangan bulat, minimal 0.");
      return;
    }
    if (!portfolio) return;
    if (hargaBeli === hargaBeliTerpakai(item) && lots === item.lot) {
      cancelEdit();
      return;
    }
    setSavingTicker(item.name);
    try {
      const response = await portofolioService.updateHolding(
        portfolio.id,
        item.name,
        {
          harga_beli: hargaBeli,
          jumlah_lot: lots,
          expected_lots: item.lot,
        },
      );
      if (response.status !== "success" || !response.data)
        throw new Error(response.message || "Perubahan belum tersimpan.");
      setPortfolio(response.data);
      setAllSnapshots((snapshots) =>
        snapshots.map((snapshot) =>
          snapshot.id === response.data.id ? response.data : snapshot,
        ),
      );
      setCachedPortfolio("live", response.data);
      setHargaBeliMap({});
      setHoldingsRevision((value) => value + 1);
      cancelEdit();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setEditError(
        detail ||
          (error instanceof Error
            ? error.message
            : "Perubahan gagal disimpan."),
      );
    } finally {
      setSavingTicker(null);
    }
  };

  const saveIdentity = async () => {
    if (!liveManagementPortfolio) return;
    const name = identityName.trim();
    if (!name || name.length > 80 || identityDescription.length > 500) {
      setIdentityError("Nama wajib diisi (maksimal 80 karakter); deskripsi maksimal 500 karakter.");
      return;
    }
    setSavingIdentity(true);
    setIdentityError(null);
    try {
      const response = await portofolioService.updatePortfolioIdentity(
        liveManagementPortfolio.id,
        { name_portofolio: name, description: identityDescription.trim() || null },
      );
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || "Identitas portofolio belum tersimpan.");
      }
      setAllSnapshots((snapshots) => snapshots.map((snapshot) =>
        selectedSeries?.snapshots.some((item) => item.id === snapshot.id)
          ? { ...snapshot, name_portofolio: name, description: identityDescription.trim() || null }
          : snapshot,
      ));
      setPortfolio((current) => current && selectedSeries?.snapshots.some((item) => item.id === current.id)
        ? { ...current, name_portofolio: name, description: identityDescription.trim() || null }
        : current);
      setCachedPortfolio("live", response.data);
      setEditingIdentity(false);
    } catch (error) {
      setIdentityError(portfolioActionError(error, "Gagal menyimpan nama portofolio."));
    } finally {
      setSavingIdentity(false);
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
  const gainOnPaidCapitalPct = returnMetrics?.cash_return_pct ?? null;
  const latestPerformancePoint = displayPerformance?.series.at(-1) ?? null;

  // ===== Batas date picker end_date (mode backtest) =====
  // Minimal HARI SETELAH tanggal simulasi (date_ref + 1) agar kurva punya
  // minimal 2 titik data, maksimal data historis terakhir (BACKTEST_DATA_MAX).
  const minEndDate = latestSnapshotDay
    ? addDaysIso(latestSnapshotDay, 1)
    : BACKTEST_DATA_MIN;
  const isEndDateValid = endDate >= minEndDate && endDate <= BACKTEST_DATA_MAX;

  if (!portfolio) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {isLoading ? "Memuat portofolio..." : "Portofolio tidak tersedia"}
        </h1>
        {!isLoading && (
          <p className="text-sm text-slate-600">
            {fetchError || "Portofolio yang dipilih tidak dapat ditampilkan."}
          </p>
        )}
        <Link to="/portfolios" className="inline-block">
          <Button variant="outline">Kembali ke daftar portofolio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 animate-in fade-in duration-500">
      {isPreviewingBear && <MarketPreviewStatus />}
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Portofolio
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            {seriesName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {selectedSeries?.latest.description || portfolio?.description ||
              "Belum ada deskripsi portofolio."}
          </p>
          {mode === "live" && liveManagementPortfolio && (
            <div className="mt-2">
              {editingIdentity ? (
                <div className="flex max-w-md flex-col gap-2">
                  <Input
                    aria-label="Nama portofolio"
                    maxLength={80}
                    value={identityName}
                    onChange={(event) => setIdentityName(event.target.value)}
                  />
                  <Input
                    aria-label="Deskripsi portofolio"
                    maxLength={500}
                    value={identityDescription}
                    onChange={(event) => setIdentityDescription(event.target.value)}
                  />
                  {identityError && <p className="text-xs text-red-600">{identityError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveIdentity} disabled={savingIdentity}>Simpan</Button>
                    <Button size="sm" variant="outline" disabled={savingIdentity} onClick={() => setEditingIdentity(false)}>Batal</Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setIdentityName(seriesName);
                    setIdentityDescription(selectedSeries?.latest.description || portfolio.description || "");
                    setIdentityError(null);
                    setEditingIdentity(true);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Edit nama & deskripsi
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/portfolios" className="w-full sm:w-auto">
            <Button variant="outline" className="h-10 gap-2">
              <History className="h-4 w-4" /> Daftar Portofolio
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

      {/* Mode mengikuti portofolio yang dipilih dari daftar. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            {mode === "backtest" ? "Backtest" : "Live"}
          </span>
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
                    : snapshot.execution_date ||
                      snapshot.date_ref ||
                      snapshot.created_at
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

      {mode === "live" && portfolio && liveManagementPortfolio && (
        <details
          open
          className="group rounded-2xl border border-slate-200 bg-card px-4 py-3 sm:px-5"
        >
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
                  Setor dana atau jalankan rebalance satu kali
                  {(liveManagementPortfolio.pending_deposit ?? 0) > 0
                    ? ` · ${formattedRupiah(liveManagementPortfolio.pending_deposit ?? 0)} menunggu`
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
                  Mengelola posisi terbaru dari portofolio yang dipilih. Catat
                  setoran sekarang. Dana baru akan masuk ke kas dan perhitungan
                  NAV ketika rebalance dijalankan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-xs font-medium text-slate-600">
                      Menunggu rebalance
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-primary">
                      {formattedRupiah(
                        liveManagementPortfolio.pending_deposit ?? 0,
                      )}
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
                      {formattedRupiah(liveManagementPortfolio.sisa_budget)}
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

                {/* <FitnessPolicySelect value={fitnessPolicy} onChange={setFitnessPolicy}
                  disabled={isRunningRebalance || isPreviewingBear || liveBearPreview !== null} /> */}
                {/* <label className="flex items-start gap-3 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={guardedRebalance}
                    disabled={
                      isRunningRebalance ||
                      isPreviewingBear ||
                      liveBearPreview !== null
                    }
                    onChange={(event) =>
                      setGuardedRebalance(event.target.checked)
                    }
                  />
                  Pertahankan posisi bila pergantian belum cukup bermanfaat
                  (eksperimen)
                </label> */}
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-lg text-xs leading-relaxed text-slate-500">
                    Rebalance langsung mengikuti hasil GA. Saham yang tidak
                    dapat diperdagangkan tetap dimiliki; lot dan average beli
                    bisa Anda sesuaikan.
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
      {mode === "backtest" && portfolio && managementPortfolio && (
        <details
          open
          className="group rounded-2xl border border-slate-200 bg-card px-4 py-3 sm:px-5"
        >
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
                  Komposisi portofolio awal yang tersimpan dipakai langsung.
                  GA hanya dijalankan pada tanggal rebalance berikutnya.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* <FitnessPolicySelect
                  value={fitnessPolicy}
                  onChange={setFitnessPolicy}
                  disabled={
                    isRunningRebalance ||
                    isPreviewingBear ||
                    seriesBearPreview !== null
                  }
                /> */}
                <div className="space-y-2">
                  {/* <label
                    htmlFor="guarded-rebalance"
                    className="flex items-start gap-3 text-sm font-medium text-slate-900"
                  >
                    <input
                      id="guarded-rebalance"
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      checked={guardedRebalance}
                      disabled={
                        isRunningRebalance ||
                        isPreviewingBear ||
                        seriesBearPreview !== null
                      }
                      onChange={(event) =>
                        setGuardedRebalance(event.target.checked)
                      }
                    />
                    Pertahankan posisi bila pergantian belum cukup bermanfaat
                    (eksperimen)
                  </label> */}
                  {guardedRebalance && (
                    <p className="text-xs leading-relaxed text-slate-500">
                      Membandingkan pergantian saham dengan tetap memegang
                      posisi saat ini. Fitness yang dipilih dipakai sejak
                      portofolio awal hingga rebalance terakhir. Hasil penjualan
                      dapat tetap menjadi kas. Hasil eksperimen belum menjamin
                      return lebih tinggi.
                    </p>
                  )}
                </div>
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
                        Snapshot terakhir
                      </Label>
                      <Input
                        id="rebalance-start-date"
                        type="date"
                        value={rebalanceBaseDate}
                        disabled
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
                        min={minRebalanceEndDate}
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
                            e.target.value === "" ? 0 : Number(e.target.value),
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
                        disabled={isRunningRebalance || contributionAmount <= 0}
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
                    Tanggal akhir harus mencakup rebalance pertama pada {minRebalanceEndDate}
                    dan tidak melewati {BACKTEST_DATA_MAX}.
                  </p>
                )}
                {!rebalanceIntervalValid && (
                  <p className="text-xs text-red-600">
                    Interval harus berupa bilangan bulat antara 1 dan 12 bulan.
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
                      <p className="text-xs text-slate-500">Setoran berkala</p>
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
                    GA dijalankan untuk setiap periode rebalance. Proses mungkin
                    memakan waktu beberapa menit.
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
                        <Activity className="w-4 h-4" />{" "}
                        Menjalankan Rebalance...
                      </>
                    ) : isPreviewingBear ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" /> Memeriksa
                        pasar...
                      </>
                    ) : (
                      <>
                        <Repeat className="w-4 h-4" /> Jalankan Rebalance Series
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
          <div className="grid min-w-0 gap-3 md:grid-cols-3 [&>*]:min-w-0 [&_p]:[overflow-wrap:anywhere]">
            <Card className="border-primary/20 bg-primary/5 shadow-sm md:col-span-1">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-slate-600">
                  {performanceWindow?.isSegment
                    ? "Nilai akhir periode"
                    : "Nilai portofolio"}
                </p>
                <p className="mt-2 text-xl font-semibold leading-snug tabular-nums text-slate-900 xl:text-2xl">
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
                  {gainOnPaidCapitalPct != null
                    ? `Return atas dana masuk ${gainOnPaidCapitalPct.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
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

          <PortfolioReturnSummary metrics={returnMetrics} />

          {mode === "backtest" &&
            displayPerformance &&
            performancePortfolioId && (
              <RiskEvaluationPanel
                key={`${performanceRequestKey}:${portfolio.id}:${displayPerformance.start_date}:${displayPerformance.end_date}:${displayPerformance.final_nav}:${performanceScope}`}
                portfolioId={performanceWindow?.evaluationPortfolioId ?? performancePortfolioId}
                profile={portfolio.risk_profile}
                startDate={displayPerformance.start_date}
                endDate={displayPerformance.end_date}
                overallPortfolioId={performancePortfolioId}
                overallStartDate={effectivePerformance?.start_date}
                overallEndDate={effectivePerformance?.end_date}
                backtest={true}
              />
            )}

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 [&>div]:min-w-0">
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
                        data={holdings.filter((item) => item.lot > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {holdings
                          .filter((item) => item.lot > 0)
                          .map((_, index) => (
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

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 [&>div]:min-w-0">
            <div className="lg:col-span-2 space-y-8">
              {/* Detailed Holding Table */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-slate-500" /> Saham yang
                    Dimiliki
                  </CardTitle>
                  {mode === "live" &&
                    portfolio.status_portofolio === "active" && (
                      <p className="text-xs leading-relaxed text-slate-500">
                        Tanpa perubahan, posisi mengikuti GA. Edit lot dan
                        average beli sesuai catatan Anda. Lot 0 berarti tidak
                        dimiliki; kas mengikuti harga acuan.
                      </p>
                    )}
                  {mode === "live" && portfolio.status_portofolio !== "active" && selectedSeries?.latest.status_portofolio === "active" && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Posisi historis hanya dapat dilihat. Lot dan harga beli dapat diedit pada posisi terbaru.</span>
                      <Button size="sm" variant="outline" onClick={() => {
                        setPerformanceView({ key: location.key, scope: "period" });
                        setPortfolio(selectedSeries.latest);
                      }}>Lihat posisi terbaru</Button>
                    </div>
                  )}
                  {portfolio.holdings_edited && (
                    <p className="text-xs text-slate-500">
                      Posisi telah disesuaikan. Skor GA mengacu pada rekomendasi
                      awal.
                    </p>
                  )}
                  <CardDescription>
                    Harga per lembar. Acuan memakai Close sesi
                    {portfolio.price_date || portfolio.execution_date
                      ? ` ${(portfolio.price_date || portfolio.execution_date)!.slice(0, 10)}`
                      : ""}
                    ; average beli dihitung dari riwayat lot dan harga eksekusi.
                    Data lama memakai harga acuan yang tercatat saat pembelian.
                    Riwayat yang tidak lengkap ditandai belum diketahui.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
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
                            Average beli
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Lot
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Nilai
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((item) => {
                          const acuan = hargaAcuanPerLembar(item);
                          const averageBeli = hargaBeliTerpakai(item);
                          const isEditing = editingTicker === item.name;
                          const isSaving = savingTicker === item.name;
                          const canEdit =
                            mode === "live" &&
                            portfolio.status_portofolio === "active";
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
                                      <RupiahInput
                                        autoFocus
                                        aria-label={`Average beli ${item.name}`}
                                        aria-invalid={!!editError}
                                        value={editValue}
                                        onValueChange={(value) => {
                                          setEditValue(value);
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
                                        disabled={
                                          isSaving || !editValue || !editLots
                                        }
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
                                      {averageBeli === null
                                        ? "Belum diketahui"
                                        : `Rp ${formatRupiahAngka(averageBeli)}`}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => startEdit(item)}
                                      disabled={!canEdit}
                                      title={
                                        canEdit
                                          ? "Edit lot dan average beli"
                                          : mode === "backtest"
                                            ? "Harga beli hanya bisa diubah pada portofolio live"
                                            : portfolio.status_portofolio !==
                                                "active"
                                              ? "Harga beli portofolio lama tidak dapat diubah"
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
                                {isEditing ? (
                                  <RupiahInput
                                    aria-label={`Jumlah lot ${item.name}`}
                                    value={editLots}
                                    onValueChange={(value) => {
                                      setEditLots(value);
                                      setEditError(null);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") saveEdit(item);
                                      if (event.key === "Escape") cancelEdit();
                                    }}
                                    disabled={isSaving}
                                    className="h-9 w-28 bg-card"
                                  />
                                ) : (
                                  `${item.lot.toLocaleString("id-ID")} Lot`
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap">
                                Rp {item.total.toLocaleString("id-ID")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Rincian Rebalance (hanya bila portofolio dibuat dengan rebalance) */}
              {!!portfolio?.deferred_signals?.length && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-semibold">Sinyal GA belum dieksekusi</p>
                  <p className="mt-1 text-xs text-amber-800">
                    Saham ini tidak diperdagangkan pada hari rebalance. Lot saat
                    ini tetap dimiliki; target GA bukan transaksi atau pesanan
                    otomatis. Saat saham kembali diperdagangkan, target dan
                    harga perlu dinilai ulang.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {portfolio.deferred_signals.map((signal) => (
                      <span
                        key={signal.ticker}
                        className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs"
                      >
                        <strong>{signal.ticker}</strong> ·{" "}
                        {signal.action === "BUY"
                          ? "Sinyal beli"
                          : "Sinyal jual"}{" "}
                        · {signal.held_lots} → {signal.target_lots} lot
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>div]:min-w-0 [&>div]:overflow-hidden [&>div>div:last-child]:text-lg [&>div>div:last-child]:leading-snug [&>div>div:last-child]:tabular-nums [&>div>div:last-child]:[overflow-wrap:anywhere] [&>div>div:last-child]:flex-wrap [&_svg]:shrink-0">
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
                            {portfolio?.fitness_policy === "legacy_cvar_v1"
                              ? "Fitness Lama + CVaR"
                              : "Fitness Score"}
                          </div>
                          <div className="text-2xl font-bold text-slate-900">
                            {portfolio
                              ? portfolio.fitness_score.toFixed(
                                  portfolio.fitness_policy &&
                                    portfolio.fitness_policy !== "legacy"
                                    ? 6
                                    : 2,
                                )
                              : "—"}
                          </div>
                          {portfolio?.fitness_policy === "legacy_cvar_v1" &&
                            portfolio.fitness_diagnostics && (
                              <p className="mt-2 text-xs font-normal text-slate-500">
                                {portfolio.fitness_diagnostics.scenario_count}{" "}
                                skenario historis ×{" "}
                                {portfolio.fitness_diagnostics.horizon_days}{" "}
                                sesi.
                                {portfolio.fitness_diagnostics.legacy_score !=
                                null
                                  ? `Skor lama ${portfolio.fitness_diagnostics.legacy_score.toFixed(4)}; penalti CVaR ${portfolio.fitness_diagnostics.cvar_penalty.toFixed(4)};`
                                  : `Return bersih ${(portfolio.fitness_diagnostics.mean_net_return * 100).toFixed(2)}%;`}
                                CVaR{" "}
                                {(
                                  portfolio.fitness_diagnostics.downside_cvar *
                                  100
                                ).toFixed(4)}
                                %;
                                {portfolio.fitness_diagnostics.downside_cvar ===
                                  0 &&
                                  " Ekor skenario tidak rugi; ini bukan berarti risiko investasi nol."}
                              </p>
                            )}
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
                        Analisis Portofolio
                      </CardTitle>
                      <CardDescription className="text-slate-600 text-base">
                        {portfolio?.rebalance_diagnostics?.narrative_source === "verified_template" ||
                        portfolio?.rebalance_diagnostics?.narrative_source === "ga_template"
                          ? "Penjelasan berdasarkan perhitungan GA"
                          : "Makna hasil optimasi, fundamental saham, dan pertimbangan risikonya"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="space-y-4">
                        {portfolio ? (
                          <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-line">
                            {portfolio.narasi_llm}
                          </p>
                        ) : (
                          <p className="text-slate-700 leading-relaxed text-[15px]">
                            Analisis tersedia setelah portofolio selesai dibuat.
                          </p>
                        )}
                        <PortfolioNewsContext news={portfolio?.rebalance_diagnostics?.news_context} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </details>
            </div>
          </div>
        </>
      )}
      {isRunningRebalance && (
        <PortfolioProgressDialog store={analysis.store} rebalance onCancel={analysis.cancel} />
      )}
      {liveBearPreview && (
        <BearMarketDialog
          key={liveBearPreview.fingerprint}
          assessments={[liveBearPreview]}
          initialPolicy={bearPolicy}
          capital={displayPerformance?.final_nav ?? portfolio?.budget}
          busy={isRunningRebalance}
          hidden={isRunningRebalance}
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
          askRebalanceMethod
          initialPolicy={bearPolicy}
          capital={effectivePerformance?.initial_capital ?? portfolio?.budget}
          busy={isRunningRebalance}
          hidden={isRunningRebalance}
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
