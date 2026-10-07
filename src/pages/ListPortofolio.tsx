import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  Plus,
  RefreshCw,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { PortfolioData, PortfolioMode } from "@/types";
import { portofolioService } from "@/services/portofolioService";
import {
  getBacktestDateRef,
  getPortfolioMode,
  setBacktestDateRef,
  setPortfolioMode,
} from "@/lib/portfolioMode";

/** Format angka Rupiah tanpa desimal (mis. "Rp 250.000.000"). */
const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

/** Label manusiawi untuk kolom status_portofolio backend. */
const STATUS_LABEL: Record<string, string> = {
  active: "Live Aktif",
  replaced: "Live Digantikan",
  active_backtest: "Backtest Aktif",
  replaced_backtest: "Backtest Digantikan",
};

/** Kelas warna Badge per status (mode dibedakan lewat status backend). */
const statusBadgeClass = (status: string): string => {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "active_backtest":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "replaced":
    case "replaced_backtest":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

/** Format tanggal ISO ("2024-06-28T00:00:00" / "2024-06-28") -> "28 Jun 2024". */
const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function ListPortofolio() {
  const navigate = useNavigate();

  // ===== Mode program: "live" (aktif & tergantikan) / "backtest" =====
  const [mode, setMode] = useState<PortfolioMode>(() => getPortfolioMode());

  // ===== Daftar portofolio dari endpoint /my-portofolio/all =====
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Diinkremen tombol "Muat Ulang" untuk memicu ulang efek pemuatan.
  const [reloadToken, setReloadToken] = useState(0);

  /** Ganti mode program (Live <-> Backtest) dan simpan preferensinya. */
  const handleModeChange = (next: PortfolioMode) => {
    if (next === mode) return;
    setPortfolioMode(next);
    setMode(next);
    if (next === "backtest") setBacktestDateRef(getBacktestDateRef());
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await portofolioService.getAllMyPortofolios(
          mode === "backtest",
        );
        if (cancelled) return;
        if (res.status === "success" && Array.isArray(res.data)) {
          setPortfolios(res.data);
        } else {
          setPortfolios([]);
          setError(
            `Backend mengembalikan status="${res.status}" dengan data tidak valid.`,
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Gagal memuat daftar portofolio:", err);
        setPortfolios([]);
        setError(
          "Gagal memuat daftar portofolio dari server. Periksa koneksi lalu coba lagi.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [mode, reloadToken]);

  /** Buka detail portofolio terpilih di halaman /portfolio. */
  const openPortfolio = (portfolio: PortfolioData) => {
    setPortfolioMode(mode);
    if (mode === "backtest") {
      setBacktestDateRef(portfolio.date_ref?.slice(0, 10) ?? null);
    }
    navigate("/portfolio", {
      state: {
        mode,
        dateRef: portfolio.date_ref?.slice(0, 10) ?? null,
        portfolio,
        selectedPortfolioId: portfolio.id,
        formData: { capital: String(portfolio.budget) },
        riskProfile: portfolio.risk_profile,
      },
    });
  };

  const isBacktest = mode === "backtest";


  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Riwayat Portofolio
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Semua portofolio Anda beserta statusnya. Pilih salah satu untuk
            melihat detail lengkap.
          </p>
        </div>
        <Link to="/generate" state={{ mode }} className="w-full md:w-auto">
          <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-11 px-6">
            <Plus className="w-5 h-5 mr-2" />
            Rekomendasi Baru
          </Button>
        </Link>
      </div>

      {/* Toolbar: pilih mode Live / Backtest */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Mode Program</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBacktest
              ? "Menampilkan seluruh portofolio hasil simulasi backtest (aktif maupun yang sudah digantikan)."
              : "Menampilkan seluruh portofolio live (aktif maupun yang sudah digantikan)."}
          </p>
        </div>
        <div className="md:ml-auto flex flex-wrap items-end gap-4">
          <PortfolioModeToggle mode={mode} onChange={handleModeChange} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={isLoading}
            onClick={() => setReloadToken((t) => t + 1)}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Muat Ulang
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-800">
          <Activity className="w-5 h-5 shrink-0 animate-spin" />
          <p className="text-sm">Memuat daftar portofolio dari server...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && portfolios.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
          {isBacktest ? (
            <FlaskConical className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <Briefcase className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-semibold">
              Belum ada portofolio {isBacktest ? "backtest" : "live"}
            </p>
            <p className="mt-1">
              Jalankan <strong>Rekomendasi Baru</strong> dalam mode{" "}
              {isBacktest ? "Backtest" : "Live"} untuk membuat portofolio
              {isBacktest ? " simulasi" : ""} pertama Anda.
            </p>
            <Link to="/generate" state={{ mode }}>
              <Button
                size="sm"
                className={`mt-3 h-8 ${
                  isBacktest
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Buat Rekomendasi Baru
              </Button>
            </Link>
          </div>
        </div>
      )}


      {/* Daftar kartu portofolio */}
      {!isLoading && portfolios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {portfolios.map((p) => {
            const status = p.status_portofolio;
            const isActiveStatus =
              status === "active" || status === "active_backtest";
            return (
              <Card
                key={p.id}
                className={`shadow-sm border-slate-200 flex flex-col transition-shadow hover:shadow-md ${
                  isActiveStatus ? "ring-1 ring-blue-100" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {isBacktest ? (
                          <FlaskConical className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Briefcase className="w-5 h-5 text-blue-600" />
                        )}
                        {p.risk_profile}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {isBacktest
                          ? `Simulasi per ${formatDate(p.date_ref)}`
                          : `Dibuat ${formatDate(p.created_at)}`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusBadgeClass(status)}>
                      {STATUS_LABEL[status] ?? status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  {/* Modal & terpakai */}
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <Wallet className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        Modal Dialokasikan
                      </p>
                      <p className="text-base font-bold text-slate-900 truncate">
                        {formatRupiah(p.budget)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Terpakai {formatRupiah(p.total_terpakai)} &middot; Sisa{" "}
                        {formatRupiah(p.sisa_budget)}
                      </p>
                    </div>
                  </div>

                  {/* Metrik utama */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 rounded-lg border border-slate-100 py-2">
                      <p className="text-[11px] text-slate-500">Fitness</p>
                      <p className="text-sm font-bold text-slate-900">
                        {p.fitness_score?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg border border-slate-100 py-2">
                      <p className="text-[11px] text-slate-500">Sharpe</p>
                      <p className="text-sm font-bold text-slate-900">
                        {p.sharpe_ratio?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg border border-slate-100 py-2">
                      <p className="text-[11px] text-slate-500">
                        Maks. Drawdown
                      </p>
                      <p className="text-sm font-bold text-red-600 flex items-center justify-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {p.max_drawdown != null
                          ? `${(p.max_drawdown * 100).toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Expected Return:{" "}
                      <strong className="text-slate-700">
                        {p.expected_return != null
                          ? `${(p.expected_return * 100).toFixed(2)}%`
                          : "—"}
                      </strong>
                    </span>
                    <span>
                      Saham Aktif:{" "}
                      <strong className="text-slate-700">{p.n_active}</strong>
                    </span>
                    <span>
                      Alokasi:{" "}
                      <strong className="text-slate-700">
                        {p.allocations?.length ?? 0} item
                      </strong>
                    </span>
                  </div>

                  <Button
                    onClick={() => openPortfolio(p)}
                    className={`mt-auto w-full h-10 gap-2 ${
                      isBacktest
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    Lihat Detail
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && portfolios.length > 0 && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5" />
          Total {portfolios.length} portofolio {isBacktest ? "backtest" : "live"}.
          Portofolio berstatus &ldquo;digantikan&rdquo; tetap tersimpan dan bisa
          dibuka kembali.
        </p>
      )}
    </div>
  );
}

