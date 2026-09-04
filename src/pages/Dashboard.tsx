import { useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Briefcase,
  TrendingDown,
  Info,
  Bot,
  Activity,
  CheckCircle2,
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
} from "@/types";

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

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    formData: FormData;
    riskProfile: RiskProfile;
  } | null;

  if (!state) {
    return <Navigate to="/" replace />;
  }

  const { formData, riskProfile } = state;
  const formattedCapital = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(Number(formData.capital));

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl shadow-card border border-border">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-blue-600" />
              Rekomendasi Portofolio Anda
            </h1>
            <p className="text-slate-500 mt-1">
              Dihasilkan melalui optimasi Algoritma Genetika
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm">
              <span className="text-slate-500 block">Modal Awal</span>
              <span className="font-bold text-slate-900">
                {formattedCapital}
              </span>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg text-sm border border-blue-100">
              <span className="text-blue-600 block">Profil Risiko</span>
              <span className="font-bold text-blue-900">{riskProfile}</span>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Ubah Profil
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pie Chart & Allocation */}
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Persentase Portofolio</CardTitle>
              <CardDescription>Distribusi alokasi dana optimal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockPortfolioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {mockPortfolioData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `${value}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Historical Performance */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                Performa Historis IHSG vs Portofolio
              </CardTitle>
              <CardDescription>
                Simulasi backtesting 4 tahun terakhir (Cumulative Return %)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mockHistoricalData}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="portfolio"
                      name="Portofolio Anda"
                      stroke="#117a58"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ihsg"
                      name="IHSG"
                      stroke="#e0a83a"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details & LLM Narration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table & Metrics */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Rincian Pembelian</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Harga/Lembar</TableHead>
                      <TableHead>Jumlah Lot</TableHead>
                      <TableHead className="text-right">Total (Rp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPortfolioData.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-bold">{item.name}</TableCell>
                        <TableCell>
                          Rp {item.price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell>{item.lot} Lot</TableCell>
                        <TableCell className="text-right font-medium">
                          Rp {item.total.toLocaleString("id-ID")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" /> Metrik Portofolio (Fitness
                  Score)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Sharpe Ratio
                    </div>
                    <div className="text-lg font-bold text-slate-900">1.05</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Max Drawdown
                    </div>
                    <div className="text-lg font-bold text-red-600 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" /> 9%
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Rata-rata Korelasi
                    </div>
                    <div className="text-lg font-bold text-slate-900">0.40</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Skor Fundamental
                    </div>
                    <div className="text-lg font-bold text-emerald-600 flex items-center gap-1">
                      0.95{" "}
                      <span className="text-[10px] text-slate-400 font-normal">
                        (Skala 0-1)
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Penalti Modal
                    </div>
                    <div className="text-lg font-bold text-slate-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 0
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <div className="text-xs text-slate-500 mb-1">
                      Penalti Diversifikasi
                    </div>
                    <div className="text-lg font-bold text-slate-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 0
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LLM Narration */}
          <Card className="lg:col-span-1 shadow-sm border-emerald-200 bg-emerald-50/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bot className="w-24 h-24 text-emerald-600" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg text-emerald-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-600" />
                Interpretasi AI
              </CardTitle>
              <CardDescription className="text-emerald-700/70">
                Analisis rasional dari Large Language Model
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="prose prose-sm prose-emerald">
                <p className="text-slate-700 leading-relaxed">
                  Alokasi <strong>{riskProfile?.toLowerCase()}</strong> ini
                  berfokus pada perlindungan modal melalui seleksi tiga emiten
                  raksasa lintas sektor (BBCA, ICBP, TLKM) yang memiliki
                  ketahanan bisnis nyaris sempurna (Skor Fundamental 0.95).
                </p>
                <p className="text-slate-700 leading-relaxed mt-3">
                  Secara matematis, diversifikasi ini menghasilkan tingkat
                  korelasi yang solid (0.40) untuk mencegah pergerakan harga
                  yang searah.
                </p>
                <p className="text-slate-700 leading-relaxed mt-3">
                  Ditopang oleh efisiensi imbal hasil yang memadai{" "}
                  <em>(Sharpe Ratio 1.05)</em>, algoritma berhasil menekan
                  potensi risiko kejatuhan terdalam <em>(Max Drawdown)</em> pada
                  level yang sangat aman, yakni maksimal hanya 9% saat indeks
                  pasar mengalami krisis.
                </p>
              </div>
              <div className="mt-6 flex items-start gap-2 bg-white/60 p-3 rounded-lg border border-emerald-100">
                <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">
                  Sistem mendeteksi tren pasar saat ini stabil. Pemilihan saham
                  difokuskan pada ketahanan jangka panjang sesuai profil risiko
                  Anda.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
