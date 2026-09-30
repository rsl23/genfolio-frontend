import type { PortfolioData, PortfolioMode } from "@/types";

/**
 * Rentang data historis yang tersedia untuk simulasi backtest.
 * Sumber: data/Master_OHLCV_15Tahun.parquet (dibaca 2026-09-21).
 * Dipakai sebagai batas `min`/`max` input tanggal agar user tidak memilih
 * date_ref / end_date di luar cakupan data parquet (GA akan gagal di backend).
 */
export const BACKTEST_DATA_MIN = "2011-08-18";
export const BACKTEST_DATA_MAX = "2026-08-13";

/**
 * Rentang tanggal yang BOLEH dipilih user pada input tanggal (date picker)
 * halaman Rekomendasi Baru. Sengaja lebih sempit dari cakupan data mentah
 * (BACKTEST_DATA_MIN) agar GA selalu mendapat histori yang panjang sebelum
 * tanggal simulasi. Batas atas = data historis terakhir yang tersedia.
 */
export const BACKTEST_PICKER_MIN = "2016-01-01";
export const BACKTEST_PICKER_MAX = BACKTEST_DATA_MAX;

// Kunci localStorage — dipakai agar mode yang dipilih tetap konsisten
// ketika user berpindah antara /generate dan /portfolio atau me-reload halaman.
const MODE_KEY = "genfolio.portfolio_mode";
const DATE_REF_KEY = "genfolio.backtest_date_ref";
const CACHE_PREFIX = "genfolio.portfolio_cache.";

/** Tanggal hari ini (waktu lokal browser) dalam format "YYYY-MM-DD". */
export function getTodayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Kurangi sejumlah tahun dari tanggal ISO "YYYY-MM-DD" (waktu lokal). */
export function subtractYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year, (month ?? 1) - 1, day ?? 1);
  dt.setFullYear(dt.getFullYear() - years);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Tambah sejumlah hari ke tanggal ISO "YYYY-MM-DD" (waktu lokal). */
export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year, (month ?? 1) - 1, day ?? 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Jepit tanggal ISO ke rentang data backtest (perbandingan string ISO sudah aman). */
export function clampToBacktestRange(isoDate: string): string {
  if (isoDate < BACKTEST_DATA_MIN) return BACKTEST_DATA_MIN;
  if (isoDate > BACKTEST_DATA_MAX) return BACKTEST_DATA_MAX;
  return isoDate;
}

/** Jepit tanggal ISO ke rentang yang boleh dipilih user di date picker. */
export function clampToBacktestPickerRange(isoDate: string): string {
  if (isoDate < BACKTEST_PICKER_MIN) return BACKTEST_PICKER_MIN;
  if (isoDate > BACKTEST_PICKER_MAX) return BACKTEST_PICKER_MAX;
  return isoDate;
}

/** Default date_ref simulasi: satu tahun sebelum hari ini, dijepit ke rentang data. */
export function defaultBacktestDateRef(): string {
  return clampToBacktestRange(subtractYears(getTodayIsoDate(), 1));
}

/** Default end_date kurva backtest: hari ini, dijepit ke data historis terakhir. */
export function defaultBacktestEndDate(): string {
  return clampToBacktestRange(getTodayIsoDate());
}

/** Mode terakhir yang dipilih user ("live" bila belum pernah memilih). */
export function getPortfolioMode(): PortfolioMode {
  try {
    return localStorage.getItem(MODE_KEY) === "backtest" ? "backtest" : "live";
  } catch {
    /* localStorage bisa tidak tersedia (mode privat); default "live" */
    return "live";
  }
}

export function setPortfolioMode(mode: PortfolioMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* abaikan: mode hanya perlu bertahan selama localStorage tersedia */
  }
}

/** Tanggal simulasi (date_ref) yang terakhir dipakai user. */
export function getBacktestDateRef(): string | null {
  try {
    return localStorage.getItem(DATE_REF_KEY);
  } catch {
    /* localStorage bisa tidak tersedia */
    return null;
  }
}

export function setBacktestDateRef(dateRef: string | null): void {
  try {
    if (dateRef) localStorage.setItem(DATE_REF_KEY, dateRef);
    else localStorage.removeItem(DATE_REF_KEY);
  } catch {
    /* abaikan */
  }
}

/**
 * Cache portofolio hasil generate TERAKHIR per mode. Dipakai mode backtest
 * karena endpoint GET /my-portofolio (saat ini) hanya mengembalikan portofolio
 * live — sehingga tanpa cache, detail simulasi hilang setelah halaman direload.
 */
export function getCachedPortfolio(mode: PortfolioMode): PortfolioData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + mode);
    return raw ? (JSON.parse(raw) as PortfolioData) : null;
  } catch (err) {
    console.warn("[portfolioMode] Gagal membaca cache portofolio:", err);
    return null;
  }
}

export function setCachedPortfolio(
  mode: PortfolioMode,
  data: PortfolioData | null,
): void {
  try {
    if (data) localStorage.setItem(CACHE_PREFIX + mode, JSON.stringify(data));
    else localStorage.removeItem(CACHE_PREFIX + mode);
  } catch (err) {
    console.warn("[portfolioMode] Gagal menyimpan cache portofolio:", err);
  }
}
