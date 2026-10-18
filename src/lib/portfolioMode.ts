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

/** Tambah sejumlah bulan ke tanggal ISO "YYYY-MM-DD" (waktu lokal).
 *  Akhir bulan dijepit: 2024-01-31 + 1 bulan = 2024-02-29 (bukan 2024-03-02). */
export function addMonthsIso(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(year, (month ?? 1) - 1 + months, 1);
  // Hari terakhir bulan hasil (getMonth berikutnya - 1 hari)
  const lastDay = new Date(
    dt.getFullYear(),
    dt.getMonth() + 1,
    0,
  ).getDate();
  dt.setDate(Math.min(day ?? 1, lastDay));
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/**
 * Menyusun jadwal rebalance PERIODIK untuk backtest:
 * `startDate + k x interval` (setiap X minggu/bulan) selama tanggalnya
 * masih <= `endDate`.
 *
 * @param startDate tanggal awal simulasi (date_ref) — jadwal pertama adalah
 *                  date_ref + interval (date_ref sendiri adalah pembentukan
 *                  portofolio awal, bukan rebalance).
 * @param interval  besar periode (>= 1), mis. 3 = tiap 3 bulan / 2 minggu.
 * @param unit      "week" (minggu) | "month" (bulan).
 * @param endDate   batas akhir jadwal (mis. hari ini / data historis terakhir).
 * @returns daftar tanggal "YYYY-MM-DD" terurut naik; kosong bila tidak ada
 *          tanggal valid (mis. interval melewati endDate).
 */
export function computeRebalanceDates(
  startDate: string,
  interval: number,
  unit: "week" | "month",
  endDate: string,
): string[] {
  if (!startDate || !endDate || !Number.isFinite(interval) || interval < 1) {
    return [];
  }
  const dates: string[] = [];
  // Batas iterasi sebagai pengaman (mis. input interval ekstrem)
  const MAX_DATES = 1000;
  let current = startDate;
  while (dates.length < MAX_DATES) {
    current =
      unit === "week"
        ? addDaysIso(current, 7 * interval)
        : addMonthsIso(current, interval);
    if (current > endDate) break;
    dates.push(current);
  }
  return dates;
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

// ===== Pengaturan rebalance backtest (frontend-only, backend menyusul) =====

/**
 * Konfigurasi rebalance untuk satu portofolio backtest, dipilih user di
 * halaman Portofolio Saya. Disimpan di localStorage per portofolio karena
 * endpoint backend belum tersedia — pemanggilan API menyusul setelah
 * contract disepakati.
 */
export interface RebalanceSettings {
  /** Aktifkan rebalance pada simulasi ini (default nonaktif). */
  enabled: boolean;
  /** Aktifkan rebalance periodik (setiap X minggu/bulan). */
  periodic: boolean;
  /** Satuan periode: "week" (minggu) | "month" (bulan). */
  unit: "week" | "month";
  /** Besar periode (>= 1), mis. 3 = tiap 3 bulan. */
  interval: number;
  /**
   * Tanggal rebalance pilihan user (bisa lebih dari satu), format
   * "YYYY-MM-DD". Digabung (union) dengan jadwal periodik saat generate.
   */
  customDates: string[];
}

/** Batas interval rebalance: 1..52 minggu atau 1..24 bulan per periode. */
export const REBALANCE_MAX: Record<"week" | "month", number> = {
  week: 52,
  month: 24,
};

/** Pengaturan default: periodik aktif tiap 3 bulan, tanpa tanggal custom. */
export function defaultRebalanceSettings(): RebalanceSettings {
  return {
    enabled: false,
    periodic: true,
    unit: "month",
    interval: 3,
    customDates: [],
  };
}

// Kunci localStorage pengaturan rebalance per portofolio (UUID / "latest").
const REBALANCE_SETTINGS_PREFIX = "genfolio.rebalance_settings.";

/**
 * Baca pengaturan rebalance tersimpan untuk sebuah portofolio.
 * Mengembalikan `null` bila belum pernah disimpan atau data rusak —
 * pemanggil wajib fallback ke `defaultRebalanceSettings()`.
 */
export function getRebalanceSettings(
  portfolioKey: string,
): RebalanceSettings | null {
  try {
    const raw = localStorage.getItem(REBALANCE_SETTINGS_PREFIX + portfolioKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RebalanceSettings>;
    if (!parsed || typeof parsed !== "object") return null;
    const unit = parsed.unit === "week" ? "week" : "month";
    const interval = Number(parsed.interval);
    return {
      enabled: parsed.enabled === true,
      periodic: parsed.periodic !== false,
      unit,
      interval:
        Number.isFinite(interval) && interval >= 1 && interval <= REBALANCE_MAX[unit]
          ? Math.trunc(interval)
          : defaultRebalanceSettings().interval,
      customDates: Array.isArray(parsed.customDates)
        ? parsed.customDates.filter(
            (d): d is string =>
              typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
          )
        : [],
    };
  } catch (err) {
    console.warn("[portfolioMode] Gagal membaca pengaturan rebalance:", err);
    return null;
  }
}

export function setRebalanceSettings(
  portfolioKey: string,
  settings: RebalanceSettings,
): void {
  try {
    localStorage.setItem(
      REBALANCE_SETTINGS_PREFIX + portfolioKey,
      JSON.stringify(settings),
    );
  } catch (err) {
    console.warn("[portfolioMode] Gagal menyimpan pengaturan rebalance:", err);
  }
}

/**
 * Gabungkan jadwal periodik + tanggal pilihan user menjadi satu daftar
 * tanggal unik yang terurut naik (union). Duplikat dibuang, sehingga
 * tanggal custom yang kebetulan sama dengan jadwal periodik aman.
 */
export function mergeRebalanceDates(
  periodicDates: string[],
  customDates: string[],
): string[] {
  return [...new Set([...periodicDates, ...customDates])].sort();
}
