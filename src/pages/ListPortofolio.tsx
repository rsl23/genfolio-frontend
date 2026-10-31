import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle, ArrowUpRight, Briefcase, Plus, RefreshCw, Search, Trash2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import { getBacktestDateRef, getPortfolioMode, setBacktestDateRef, setCachedPortfolio, setPortfolioMode } from "@/lib/portfolioMode";
import { groupPortfolioSeries, type PortfolioSeries } from "@/lib/portfolioSeries";
import { selectPerformanceWindow } from "@/lib/portfolioPerformanceWindow";
import { filterPortfolioSeries, portfolioTickers, sortPortfolioSeries, type PortfolioListSort } from "@/lib/portfolioListFilters";
import { portofolioService } from "@/services/portofolioService";
import type { PortfolioData, PortfolioMode, PortfolioPerformance } from "@/types";

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 2,
}).format(value);

const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value)}%`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value.slice(0, 10);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
};

type PerformancePreview = { status: "ready"; data: PortfolioPerformance } | { status: "error" };

function PerformanceChart({ performance }: { performance: PortfolioPerformance }) {
  const points = performance.series.filter((point) => point.portfolio_return !== null);
  if (points.length < 2) return <p className="flex h-24 items-center justify-center text-xs text-slate-500">Grafik belum cukup data.</p>;

  const step = Math.max(1, Math.ceil(points.length / 48));
  const chartData = points.filter((_, index) => index % step === 0 || index === points.length - 1).map((point) => ({
    date: point.date,
    portfolio: (point.portfolio_return ?? 0) * 100,
    ihsg: point.ihsg_return === null ? null : point.ihsg_return * 100,
  }));

  return (
    <div className="h-24 w-full" aria-label="Grafik return portofolio dan IHSG">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 5, bottom: 3, left: 5 }}>
          <Tooltip
            labelFormatter={(value) => formatDate(String(value))}
            formatter={(value, name) => [typeof value === "number" ? formatPercent(value) : "—", name === "portfolio" ? "Portofolio" : "IHSG"]}
            contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="portfolio" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="ihsg" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ListPortofolio() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PortfolioMode>(() => getPortfolioMode());
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);
  const [previews, setPreviews] = useState<Record<string, PerformancePreview>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tickerFilter, setTickerFilter] = useState("");
  const [sortBy, setSortBy] = useState<PortfolioListSort>("date-desc");
  const series = useMemo(() => groupPortfolioSeries(portfolios, mode), [portfolios, mode]);
  const availableTickers = useMemo(() => [...new Set(series.flatMap(portfolioTickers))].sort(), [series]);
  const highlightedTicker = tickerFilter || availableTickers.find((ticker) => ticker.toLowerCase() === searchQuery.trim().toLowerCase()) || "";
  const filteredSeries = useMemo(
    () => filterPortfolioSeries(series, mode, searchQuery, tickerFilter),
    [series, mode, searchQuery, tickerFilter],
  );
  const isPerformanceSort = sortBy === "return-asc" || sortBy === "return-desc";
  const performanceReturns = useMemo(() => Object.fromEntries(filteredSeries.map((item) => {
    const preview = previews[item.latest.id];
    const value = preview?.status === "ready"
      ? selectPerformanceWindow(preview.data, item.snapshots, item.root.id).data.total_return_pct
      : null;
    return [item.root.id, value];
  })), [filteredSeries, previews]);
  const sortedSeries = useMemo(
    () => sortPortfolioSeries(filteredSeries, mode, sortBy, performanceReturns),
    [filteredSeries, mode, sortBy, performanceReturns],
  );
  const previewTargets = useMemo(
    () => isPerformanceSort ? filteredSeries : sortPortfolioSeries(filteredSeries, mode, sortBy).slice(0, visibleCount),
    [isPerformanceSort, filteredSeries, mode, sortBy, visibleCount],
  );
  const isPerformanceSortLoading = isPerformanceSort && filteredSeries.some((item) => !previews[item.latest.id]);
  const completedPerformanceCount = filteredSeries.filter((item) => Boolean(previews[item.latest.id])).length;

  const handleModeChange = (next: PortfolioMode) => {
    if (next === mode) return;
    setPortfolioMode(next);
    setMode(next);
    setSuccess(null);
    setIsLoading(true);
    setPortfolios([]);
    setPreviews({});
    setVisibleCount(6);
    setSearchQuery("");
    setTickerFilter("");
    setSortBy("date-desc");
    if (next === "backtest") setBacktestDateRef(getBacktestDateRef());
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setPreviews({});
      try {
        const response = await portofolioService.getAllMyPortofolios(mode === "backtest");
        if (cancelled) return;
        if (response.status === "success" && Array.isArray(response.data)) {
          setPortfolios(response.data);
        } else {
          setPortfolios([]);
          setError("Daftar portofolio belum dapat ditampilkan. Coba muat ulang.");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Gagal memuat daftar portofolio:", err);
        setPortfolios([]);
        setError("Gagal terhubung ke server. Periksa koneksi lalu coba lagi.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [mode, reloadToken]);

  useEffect(() => {
    if (isLoading || error || previewTargets.length === 0) return;
    let cancelled = false;
    const pending = previewTargets.filter((item) => !previews[item.latest.id]);
    let next = 0;
    const loadPreview = async () => {
      while (!cancelled && next < pending.length) {
        const portfolio = pending[next++].latest;
        try {
          const response = await portofolioService.portfolioPerformance(portfolio.id, { backtest: mode === "backtest" });
          if (!cancelled) setPreviews((current) => ({
            ...current,
            [portfolio.id]: response.status === "success" && response.data ? { status: "ready", data: response.data } : { status: "error" },
          }));
        } catch {
          if (!cancelled) setPreviews((current) => ({ ...current, [portfolio.id]: { status: "error" } }));
        }
      }
    };
    void Promise.all([loadPreview(), loadPreview()]);
    return () => { cancelled = true; };
    // Preview state is intentionally read only when the visible page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isLoading, mode, previewTargets]);

  const openPortfolio = (item: PortfolioSeries) => {
    const portfolio = item.root;
    setPortfolioMode(mode);
    if (mode === "backtest") setBacktestDateRef(portfolio.date_ref?.slice(0, 10) ?? null);
    navigate("/portfolio", {
      state: {
        mode,
        dateRef: portfolio.date_ref?.slice(0, 10) ?? null,
        portfolio,
        selectedPortfolioId: portfolio.id,
        selectedRootPortfolioId: item.root.id,
        formData: { capital: String(portfolio.budget) },
        riskProfile: portfolio.risk_profile,
      },
    });
  };

  const deletePortfolio = async (item: PortfolioSeries) => {
    if (deletingId) return;
    const portfolio = item.root;
    const name = portfolio.name_portofolio?.trim() || `Portofolio ${portfolio.risk_profile}`;
    if (!window.confirm(
      `Hapus “${name}” beserta ${item.snapshots.length - 1} portofolio hasil rebalance dan semua item sahamnya?\n\nTindakan ini tidak dapat dibatalkan.`,
    )) return;

    setDeletingId(portfolio.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await portofolioService.deletePortfolio(portfolio.id);
      if (response.status !== "success" || !response.data) throw new Error("Respons penghapusan tidak valid.");
      const deletedIds = new Set(response.data.deleted_portfolio_ids);
      setPortfolios((current) => current.filter((snapshot) => !deletedIds.has(snapshot.id)));
      setCachedPortfolio(mode, null);
      if (mode === "backtest") {
        const active = portfolios.find((snapshot) => snapshot.id === response.data.active_portfolio_id);
        setBacktestDateRef(active?.date_ref?.slice(0, 10) ?? null);
      }
      setSuccess(`${response.data.deleted_portfolios} portofolio dan ${response.data.deleted_items} item saham berhasil dihapus.`);
      setReloadToken((token) => token + 1);
    } catch (err) {
      console.error("Gagal menghapus portofolio:", err);
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Gagal menghapus portofolio. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const isBacktest = mode === "backtest";
  const activeCount = series.filter((item) => item.latest.status_portofolio === (isBacktest ? "active_backtest" : "active")).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Portofolio</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Riwayat Portofolio</h1>
          <p className="mt-1 text-sm text-slate-500">Kenali portofolio Anda dari identitas, komposisi, dan performanya.</p>
        </div>
        <Link to="/generate" state={{ mode }}>
          <Button className="h-10 w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" /> Rekomendasi Baru</Button>
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <PortfolioModeToggle mode={mode} onChange={handleModeChange} />
          {!isLoading && !error && <span className="hidden text-xs text-slate-500 sm:inline">{series.length} portofolio · {activeCount} aktif</span>}
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-slate-600" disabled={isLoading}
          onClick={() => { setIsLoading(true); setVisibleCount(6); setReloadToken((value) => value + 1); }}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Muat ulang
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_13rem]">
        <div className="min-w-0">
          <label htmlFor="portfolio-search" className="mb-1.5 block text-xs font-medium text-slate-600">Cari portofolio</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="portfolio-search" type="search" value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(6); }}
              placeholder="Nama, tanggal, atau ticker (BBCA)" className="h-10 pl-9 pr-9" />
            {searchQuery && <button type="button" aria-label="Hapus pencarian" onClick={() => { setSearchQuery(""); setVisibleCount(6); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        <div>
          <label htmlFor="portfolio-ticker-filter" className="mb-1.5 block text-xs font-medium text-slate-600">Filter saham</label>
          <select id="portfolio-ticker-filter" value={tickerFilter}
            onChange={(event) => { setTickerFilter(event.target.value); setVisibleCount(6); }}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <option value="">Semua saham</option>
            {availableTickers.map((ticker) => <option key={ticker} value={ticker}>{ticker}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="portfolio-sort" className="mb-1.5 block text-xs font-medium text-slate-600">Urutkan</label>
          <select id="portfolio-sort" value={sortBy}
            onChange={(event) => { setSortBy(event.target.value as PortfolioListSort); setVisibleCount(6); }}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <option value="date-desc">Tanggal terbaru</option>
            <option value="date-asc">Tanggal terlama</option>
            <option value="return-desc">Return awal tertinggi</option>
            <option value="return-asc">Return awal terendah</option>
          </select>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">Tanggal memakai tanggal portofolio awal; filter saham mencakup saham yang pernah ada saat rebalance.</p>
        {!isLoading && !error && series.length > 0 &&
          <p role="status" className="text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-3">{filteredSeries.length} dari {series.length} portofolio cocok</p>}
        {!isLoading && !error && isPerformanceSort && !isPerformanceSortLoading &&
          Object.values(performanceReturns).some((value) => value == null) &&
          <p className="text-xs text-amber-700 sm:col-span-2 lg:col-span-3">Portofolio tanpa data return ditempatkan di akhir urutan.</p>}
      </div>

      {isLoading && <p role="status" className="rounded-2xl border border-slate-200 bg-card p-8 text-center text-sm text-slate-500">Memuat portofolio...</p>}
      {error && !isLoading && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}
      {success && !isLoading && !error && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>
      )}
      {!isLoading && !error && series.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-card px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Briefcase className="h-5 w-5" /></div>
          <h2 className="font-semibold text-slate-900">Belum ada portofolio {isBacktest ? "backtest" : "live"}</h2>
          <p className="mt-1 text-sm text-slate-500">Buat rekomendasi pertama untuk mulai melihat riwayat di sini.</p>
          <Link to="/generate" state={{ mode }}><Button className="mt-5 gap-2"><Plus className="h-4 w-4" /> Buat Rekomendasi</Button></Link>
        </div>
      )}

      {!isLoading && !error && series.length > 0 && filteredSeries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-card px-6 py-10 text-center">
          <h2 className="font-semibold text-slate-900">Tidak ada portofolio yang cocok</h2>
          <p className="mt-1 text-sm text-slate-500">Coba nama, tanggal lain, atau ubah filter saham.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(""); setTickerFilter(""); setVisibleCount(6); }}>Hapus filter</Button>
        </div>
      )}

      {!isLoading && !error && isPerformanceSortLoading && (
        <p role="status" className="rounded-2xl border border-slate-200 bg-card p-6 text-center text-sm text-slate-500">Menghitung return periode awal untuk mengurutkan seluruh hasil ({completedPerformanceCount}/{filteredSeries.length})...</p>
      )}

      {!isLoading && !error && filteredSeries.length > 0 && !isPerformanceSortLoading && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {sortedSeries.slice(0, visibleCount).map((item) => {
              const portfolio = item.root;
              const active = item.latest.status_portofolio === (isBacktest ? "active_backtest" : "active");
              const preview = previews[item.latest.id];
              const performance = preview?.status === "ready"
                ? selectPerformanceWindow(preview.data, item.snapshots, portfolio.id).data
                : null;
              const holdings = [...(portfolio.allocations ?? [])].sort((a, b) => b.weight - a.weight);
              const tickerMatchIndex = highlightedTicker
                ? item.snapshots.findIndex((snapshot) => snapshot.allocations?.some((allocation) => allocation.ticker.toUpperCase() === highlightedTicker))
                : -1;
              const name = portfolio.name_portofolio?.trim() || `Portofolio ${portfolio.risk_profile} · ${formatDate(isBacktest ? (portfolio.execution_date || portfolio.date_ref) : portfolio.created_at)}`;

              return (
                <article key={portfolio.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{isBacktest ? "Simulasi" : "Live"} sejak {formatDate(isBacktest ? (portfolio.execution_date || portfolio.date_ref) : portfolio.created_at)} · {item.snapshots.length - 1} rebalance</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-slate-900" title={name}>{name}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"}`}>
                      {active ? "Aktif" : "Riwayat"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{portfolio.description?.trim() || "Belum ada deskripsi untuk portofolio ini."}</p>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-xs text-slate-500">NAV akhir periode awal</p>
                      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-slate-900" title={performance?.final_nav == null ? undefined : formatRupiah(performance.final_nav)}>
                        {performance?.final_nav == null ? "—" : formatRupiah(performance.final_nav)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Return periode awal</p>
                      <p className={`mt-0.5 text-base font-semibold tabular-nums ${performance?.total_return_pct != null && performance.total_return_pct < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {performance?.total_return_pct == null ? "—" : formatPercent(performance.total_return_pct)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Modal awal</p>
                      <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-slate-700" title={formatRupiah(portfolio.budget)}>{formatRupiah(portfolio.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Profil · saham</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{portfolio.risk_profile} · {holdings.length || portfolio.n_active || 0} saham</p>
                    </div>
                  </div>

                  <div className="mt-4 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Performa awal</span>
                      <span>Portofolio <span className="text-primary">━</span> · IHSG <span className="text-slate-400">┄</span></span>
                    </div>
                    {performance ? <PerformanceChart performance={performance} /> : (
                      <p className="flex h-24 items-center justify-center text-xs text-slate-500">
                        {preview?.status === "error" ? "Performa belum tersedia." : "Memuat performa..."}
                      </p>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-medium text-slate-500">Komposisi saham awal</p>
                  {tickerMatchIndex >= 0 && <p className="mt-1 text-xs text-primary">{highlightedTicker} ditemukan pada {tickerMatchIndex === 0 ? "portofolio awal" : `Rebalance ${tickerMatchIndex}`}.</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Komposisi saham awal">
                    {holdings.slice(0, 4).map((item) => <span key={item.ticker} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{item.ticker} · {item.lots} lot</span>)}
                    {holdings.length > 4 && <span className="px-1 py-1 text-xs text-slate-500">+{holdings.length - 4} lainnya</span>}
                    {holdings.length === 0 && <span className="text-xs text-slate-500">Komposisi belum tersedia</span>}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <span className="text-xs text-slate-400">{performance ? `Hingga ${formatDate(performance.end_date)}` : ""}</span>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        aria-label={`Hapus portofolio ${name}`} disabled={deletingId !== null} onClick={() => void deletePortfolio(item)}>
                        <Trash2 className="h-4 w-4" /> {deletingId === portfolio.id ? "Menghapus..." : "Hapus"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={deletingId !== null} onClick={() => openPortfolio(item)}>
                        Lihat detail <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {sortedSeries.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + 6)}>Tampilkan {Math.min(6, sortedSeries.length - visibleCount)} lainnya</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
