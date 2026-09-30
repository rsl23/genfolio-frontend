import { memo, useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import {
  Briefcase,
  TrendingDown,
  Info,
  Bot,
  Activity,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  X,
  Check,
  FlaskConical,
  TrendingUp,
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

const COLORS = ["#117a58", "#e0a83a", "#2b8a9a", "#c25b3a", "#8b5cf6"];

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
  portfolio: number;
  ihsg: number;
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
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e0d3" />
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
          formatter={(value) => `${Number(value).toFixed(2)}%`}
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

export default function MyPortfolio() {
  const location = useLocation();
  const state = location.state as {
    formData: FormData;
    riskProfile: RiskProfile;
    /** Diisi halaman Rekomendasi Baru saat navigasi ke halaman ini. */
    mode?: PortfolioMode;
    dateRef?: string | null;
    portfolio?: PortfolioData | null;
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
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(
    null,
  );
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

  /** Ganti mode program (Live <-> Backtest) dan simpan preferensinya. */
  const handleModeChange = (next: PortfolioMode) => {
    if (next === mode) return;
    setPortfolioMode(next);
    setMode(next);
    // Edit harga beli dibatalkan saat berpindah mode
    setEditingTicker(null);
    setEditError(null);
    if (next === "backtest") {
      // Prioritas date_ref: cache portofolio backtest terakhir (field
      // `date_ref` dari backend), lalu preferensi tersimpan.
      const cached = getCachedPortfolio("backtest");
      setDateRef(cached?.date_ref?.slice(0, 10) ?? getBacktestDateRef());
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
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
            setBacktestDateRef(portfolioDateRef);
          } else {
            setDateRef(state?.dateRef ?? getBacktestDateRef());
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
      const portfolioId = portfolio?.id ?? null;
      if (!portfolioId) {
        setPerformance(null);
        setPerformanceError(null);
        return;
      }
      // end_date minimal = HARI SETELAH tanggal simulasi (date_ref + 1),
      // supaya kurva performa selalu punya minimal 2 titik data.
      if (mode === "backtest" && dateRef && endDate <= dateRef) {
        setPerformance(null);
        setPerformanceError(
          `Tanggal akhir kurva (${endDate}) tidak boleh sama atau lebih awal ` +
            `daripada tanggal simulasi portofolio (${dateRef}). ` +
            `Pilih tanggal akhir minimal ${addDaysIso(dateRef, 1)}.`,
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
        setPerformanceError(null);
      } else {
        setPerformance(null);
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
  }, [mode, portfolio?.id, endDate, dateRef]);

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

  const formattedCapital = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(budget);

  const formattedRupiah = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
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
      performance?.series.map((p) => ({
        // Backend mode backtest mengirim "2024-06-28T00:00:00" — ambil
        // bagian tanggalnya saja agar label sumbu X & tooltip bersih.
        date: p.date.slice(0, 10),
        portfolio: Math.round(p.portfolio_return * 10000) / 100, // desimal -> %
        ihsg: Math.round((p.ihsg_return ?? 0) * 10000) / 100,
      })) ?? [];
    if (raw.length <= MAX_CHART_POINTS) return raw;
    const step = Math.ceil(raw.length / MAX_CHART_POINTS);
    const sampled = raw.filter((_, index) => index % step === 0);
    const last = raw[raw.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  }, [performance]);

  const hasPerformanceData = performanceChartData.length > 0;
  const lastPoint =
    performanceChartData[performanceChartData.length - 1] ?? null;

  // ===== Warna garis =====
  // Portofolio: dinamis — hijau saat return >= 0, merah saat return < 0.
  // IHSG: SELALU kuning tetap (#e0a83a, didefinisikan di PerformanceChart)
  // sebagai benchmark agar tidak pernah sama dengan garis portofolio.
  const portfolioLineColor =
    lastPoint && lastPoint.portfolio < 0 ? "#dc2626" : "#117a58"; // merah / hijau

  // ===== Floating Profit / Loss =====
  // Dihitung dari Dana Terpakai x return terakhir portofolio (harian)
  const lastPortfolioReturn =
    performance && performance.series.length > 0
      ? performance.series[performance.series.length - 1].portfolio_return
      : null;
  const floatingPL =
    portfolio && lastPortfolioReturn !== null
      ? portfolio.total_terpakai * lastPortfolioReturn
      : null;

  // ===== Batas date picker end_date (mode backtest) =====
  // Minimal HARI SETELAH tanggal simulasi (date_ref + 1) agar kurva punya
  // minimal 2 titik data, maksimal data historis terakhir (BACKTEST_DATA_MAX).
  const minEndDate = dateRef ? addDaysIso(dateRef, 1) : BACKTEST_DATA_MIN;
  const isEndDateValid = endDate >= minEndDate && endDate <= BACKTEST_DATA_MAX;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Portofolio Saya
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Pantau dan evaluasi performa rekomendasi aset Anda.
          </p>
        </div>
        <Link to="/generate" state={{ mode }} className="w-full md:w-auto">
          <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-11 px-6">
            <Plus className="w-5 h-5 mr-2" />
            Rekomendasi Baru
          </Button>
        </Link>
      </div>

      {/* ===== Toolbar: pilih program Live atau Backtest ===== */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Mode Program</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === "backtest"
              ? `Menampilkan hasil simulasi${
                  dateRef ? ` per ${dateRef}` : ""
                } — portofolio live tidak berubah.`
              : "Menampilkan portofolio live (data pasar terbaru)."}
          </p>
        </div>
        <div className="md:ml-auto flex flex-wrap items-end gap-4">
          <PortfolioModeToggle mode={mode} onChange={handleModeChange} />
          {mode === "backtest" && (
            <div className="space-y-1">
              <Label
                htmlFor="backtest-end-date"
                className="text-xs font-medium text-slate-600"
              >
                Tanggal Akhir Kurva (end_date)
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
              <p
                className={`text-[11px] ${
                  isEndDateValid ? "text-slate-500" : "text-red-600"
                }`}
              >
                {isEndDateValid
                  ? `Pilih ${minEndDate} s/d ${BACKTEST_DATA_MAX} (minimal sehari setelah tanggal simulasi).`
                  : `Tanggal harus antara ${minEndDate} dan ${BACKTEST_DATA_MAX}.`}
              </p>
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

      {/* Keterangan mode backtest saat portofolio simulasi tersedia */}
      {mode === "backtest" && portfolio && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 text-blue-800">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Mode Simulasi:</strong> menampilkan portofolio
            {dateRef ? ` per ${dateRef}` : ""} (status{" "}
            <code>active_backtest</code>), kurva performa dihitung sampai{" "}
            {performance?.end_date?.slice(0, 10) ?? endDate}. Harga pasar harian
            tidak ditampilkan dan edit harga beli hanya tersedia di mode Live.
          </p>
        </div>
      )}

      {isMock && mode === "live" && !fetchError && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Mode Demo:</strong> Anda melihat data simulasi (mock) karena
            belum ada portofolio tersimpan di server. Untuk melihat rekomendasi
            sesungguhnya, silakan jalankan <strong>Rekomendasi Baru</strong>.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Total Modal Dialokasikan
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {formattedCapital}
            </p>
            {portfolio && (
              <p className="text-xs text-slate-500 mt-2">
                Terpakai {formattedRupiah(portfolio.total_terpakai)} &middot;
                Sisa {formattedRupiah(portfolio.sisa_budget)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Profil Risiko Target
            </p>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-blue-500"></span>
              <p className="text-2xl font-bold text-slate-900">{riskProfile}</p>
            </div>
          </CardContent>
        </Card>
        {/* Floating Profit / Loss */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Floating Profit / Loss
            </p>
            {floatingPL !== null ? (
              <>
                <div
                  className={`flex items-center gap-2 text-2xl font-bold ${
                    floatingPL >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {floatingPL >= 0 ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                  <span className={floatingPL >= 0 ? "" : ""}>
                    {floatingPL >= 0 ? "+" : "-"}
                    {formattedRupiah(Math.abs(floatingPL))}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Return{" "}
                  {lastPortfolioReturn !== null
                    ? (lastPortfolioReturn * 100).toFixed(2)
                    : "0.00"}
                  % dari Dana Terpakai
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold text-slate-400">&mdash;</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pie Chart & Allocation */}
        <Card className="lg:col-span-1 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Persentase Portofolio</CardTitle>
            <CardDescription>
              Distribusi alokasi dana secara proporsional
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
          <Card className="lg:col-span-2 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">
                Performa Return: IHSG vs Portofolio
              </CardTitle>
              <CardDescription>
                Periode {performance?.start_date?.slice(0, 10)} s/d{" "}
                {performance?.end_date?.slice(0, 10)}
                {mode === "backtest" && (
                  <>
                    {" "}
                    <span className="font-medium text-amber-700">
                      (simulasi backtest)
                    </span>
                  </>
                )}
                {lastPoint && (
                  <>
                    <br />
                    Return terakhir: Portofolio {lastPoint.portfolio.toFixed(2)}
                    % vs IHSG {lastPoint.ihsg.toFixed(2)}%
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                        : "Response endpoint berhasil tetapi 'series' kosong. Periksa Network tab (request /portofolio_performance) dan console browser untuk detail."}
                    </p>
                  </div>
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
                <Briefcase className="w-5 h-5 text-slate-500" /> Rincian
                Kepemilikan (Lot)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[110px] whitespace-nowrap">
                      Kode Emiten
                    </TableHead>
                    {/* Harga pasar harian hanya bermakna di mode live */}
                    {mode === "live" && (
                      <TableHead className="whitespace-nowrap">
                        Harga Pasar (Rp/Lembar)
                      </TableHead>
                    )}
                    <TableHead className="whitespace-nowrap">
                      {mode === "backtest"
                        ? `Harga Acuan GA per ${
                            dateRef ?? "tanggal simulasi"
                          } (Rp/Lembar)`
                        : "Harga Acuan GA (Rp/Lembar)"}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Harga Beli (Rp/Lembar)
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Lot</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      Total Nominal (Rp)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((item) => {
                    const acuan = hargaAcuanPerLembar(item);
                    const isEditing = editingTicker === item.name;
                    const isSaving = savingTicker === item.name;
                    const canEdit = mode === "live" && !isMock && !!item.itemId;
                    return (
                      <TableRow key={item.name}>
                        <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                          {item.name}
                        </TableCell>
                        {mode === "live" && (
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            Rp{" "}
                            {formatRupiahAngka(getMarketPrice(item.name, acuan))}
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
                                      ? new Intl.NumberFormat("id-ID").format(
                                          Number(
                                            editValue.replace(/\D/g, "") || 0,
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
                                Rp {formatRupiahAngka(hargaBeliTerpakai(item))}
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

          {/* Fitness Metrics */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500" /> Ringkasan &
                Komponen Evaluasi (GA)
              </CardTitle>
              <CardDescription>
                Hasil Algoritma Genetika untuk profil risiko {riskProfile}
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
                    {portfolio ? formattedRupiah(portfolio.sisa_budget) : "—"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Fitness Score
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {portfolio ? portfolio.fitness_score.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Sharpe Ratio
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {portfolio ? portfolio.sharpe_ratio.toFixed(2) : "1.05"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Expected Return
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {portfolio
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
                    {portfolio ? portfolio.avg_correlation.toFixed(2) : "0.40"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Skor Fundamental
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 flex items-baseline gap-1">
                    {portfolio ? portfolio.skor_fundamental.toFixed(2) : "0.95"}{" "}
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
                    {portfolio ? `${portfolio.n_active} Saham Aktif` : "Lolos"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LLM Narration */}
        <div className="lg:col-span-1">
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
                      ini dirancang berfokus pada perlindungan modal secara
                      substansial. Algoritma melakukan seleksi ketat dan memilih
                      tiga emiten raksasa (BBCA, ICBP, TLKM) yang memiliki
                      fundamental bisnis sangat solid (Skor 0.95).
                    </p>
                    <p className="text-slate-700 leading-relaxed text-[15px]">
                      Dari sudut pandang matematis, portofolio ini mencatatkan
                      tingkat korelasi rendah (0.40). Hal ini sangat krusial
                      untuk mencegah penurunan serentak jika pasar sedang
                      terkoreksi.
                    </p>
                    <p className="text-slate-700 leading-relaxed text-[15px]">
                      Ditopang rasio imbal hasil terhadap risiko yang optimal{" "}
                      <em>(Sharpe Ratio 1.05)</em>, mesin berhasil mengunci
                      potensi kejatuhan terdalam <em>(Max Drawdown)</em> di
                      angka aman 9%, sangat sesuai dengan batas toleransi risiko
                      Anda.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-8 bg-card p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong className="text-slate-900 block mb-1">
                    Status Pasar: Normal
                  </strong>
                  Algoritma tidak mendeteksi anomali bearish makro. Fokus
                  portofolio murni pada ketahanan pertumbuhan jangka panjang.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
