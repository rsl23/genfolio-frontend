import { useEffect, useState } from "react";
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
import {
  Briefcase,
  TrendingDown,
  Info,
  Bot,
  Activity,
  CheckCircle2,
  AlertCircle,
  Plus,
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
} from "@/types";
import { portofolioService } from "@/services/portofolioService";

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

export default function MyPortfolio() {
  const location = useLocation();
  const state = location.state as {
    formData: FormData;
    riskProfile: RiskProfile;
  } | null;

  // ===== Ambil portofolio terbaru dari backend setiap kali halaman di-render =====
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await portofolioService.getMyPortofolio();
        if (cancelled) return;
        if (response.status === "success" && response.data) {
          setPortfolio(response.data);
        } else {
          setPortfolio(null);
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
  }, [location.key]);

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
      }))
    : mockPortfolioData;

  const totalAssets = portfolio?.n_active ?? mockPortfolioData.length;
  const budgetOk = portfolio?.allocated_budget_ok ?? true;

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
        <Link to="/generate" className="w-full md:w-auto">
          <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-11 px-6">
            <Plus className="w-5 h-5 mr-2" />
            Rekomendasi Baru
          </Button>
        </Link>
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

      {isMock && !fetchError && !isLoading && (
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Jumlah Aset
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {totalAssets} Saham
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-slate-500 mb-1">
              Status Optimasi
            </p>
            <div
              className={`flex items-center gap-2 ${
                budgetOk ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {budgetOk ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <p className="text-xl font-bold">
                {portfolio
                  ? budgetOk
                    ? "Lolos (GA)"
                    : "Penalti Modal"
                  : "Optimal (GA)"}
              </p>
            </div>
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
              <CardTitle className="text-lg">Ringkasan Optimasi (GA)</CardTitle>
              <CardDescription>
                Hasil Algoritma Genetika untuk profil risiko {riskProfile}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Expected Return
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {(portfolio.expected_return * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Fitness Score
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {portfolio.fitness_score.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Dana Terpakai
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formattedRupiah(portfolio.total_terpakai)}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-sm font-medium text-slate-500 mb-1">
                    Sisa Budget (Cash)
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {formattedRupiah(portfolio.sisa_budget)}
                  </div>
                </div>
              </div>
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
                    <TableHead className="w-[100px]">Kode Emiten</TableHead>
                    <TableHead>Harga / Lembar</TableHead>
                    <TableHead>Jumlah Beli</TableHead>
                    <TableHead className="text-right">
                      Total Nominal (Rp)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-bold text-slate-900">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        Rp {(Number(item.price) / 100).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {item.lot} Lot
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        Rp {item.total.toLocaleString("id-ID")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Fitness Metrics */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500" /> Komponen
                Evaluasi (Fitness Score)
              </CardTitle>
              <CardDescription>
                Indikator terukur dari Algoritma Genetika
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                    {portfolio
                      ? `${(portfolio.max_drawdown * 100).toFixed(2)}%`
                      : "9%"}
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
