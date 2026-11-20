import type { PortfolioPerformance, PortfolioReturnMetrics } from "../types/index.ts";

const dayNumber = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`) / 86_400_000;
const finite = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);
const growthPct = (logGrowth: number) => {
  const value = Math.expm1(logGrowth) * 100;
  return Number.isFinite(value) ? value : null;
};

/** Mirrors the API calculation for a client-selected snapshot window. */
export function calculateReturnMetrics({
  initialCapital, finalNav, startDate, endDate, twrReturnPct, contributions,
}: {
  initialCapital: number | null;
  finalNav: number | null;
  startDate: string;
  endDate: string;
  twrReturnPct: number | null;
  contributions: { date: string; amount: number }[];
}): PortfolioReturnMetrics {
  const start = dayNumber(startDate);
  const end = dayNumber(endDate);
  const days = Number.isFinite(end - start) ? Math.max(0, end - start) : 0;
  const result: PortfolioReturnMetrics = {
    performance_days: days,
    twr_return_pct: finite(twrReturnPct) ? twrReturnPct : null,
    cash_return: null,
    cash_return_pct: null,
    money_weighted_return_pct: null,
    money_weighted_return_annualized_pct: null,
    annualized_twr_return_pct: null,
    annualization_status: days < 365 ? "insufficient_history" : "unavailable",
  };
  if (days >= 365 && finite(twrReturnPct) && twrReturnPct >= -100) {
    result.annualized_twr_return_pct = twrReturnPct === -100 ? -100
      : growthPct(Math.log1p(twrReturnPct / 100) * 365 / days);
    if (result.annualized_twr_return_pct !== null) result.annualization_status = "available";
  }
  if (!finite(initialCapital) || initialCapital <= 0 || !finite(finalNav) || finalNav < 0) return result;
  const deposits = contributions.map(({ date, amount }) => ({ day: dayNumber(date), amount }));
  if (deposits.some(({ day, amount }) => !Number.isFinite(day) || !finite(amount) || amount < 0 || day < start || day > end)) return result;
  const paidCapital = initialCapital + deposits.reduce((total, flow) => total + flow.amount, 0);
  result.cash_return = finalNav - paidCapital;
  result.cash_return_pct = result.cash_return / paidCapital * 100;
  if (finalNav <= 0 || days === 0) return result;

  // Deposit-only cash flows have at most one XIRR root. Log future values
  // keep the solve stable without guessing a rate or adding a dependency.
  const flows = [{ day: start, amount: initialCapital }, ...deposits].filter((flow) => flow.amount > 0);
  const residual = (rate: number) => {
    const terms = flows.map(({ day, amount }) => Math.log(amount) + rate * (end - day) / 365);
    const largest = Math.max(...terms);
    return largest + Math.log(terms.reduce((sum, term) => sum + Math.exp(term - largest), 0)) - Math.log(finalNav);
  };
  let low = -700;
  let high = 700;
  if (residual(low) > 0 || residual(high) < 0) return result;
  for (let iteration = 0; iteration < 160; iteration++) {
    const middle = (low + high) / 2;
    if (residual(middle) > 0) high = middle;
    else low = middle;
  }
  const rate = (low + high) / 2;
  result.money_weighted_return_pct = growthPct(rate * days / 365);
  if (days >= 365) result.money_weighted_return_annualized_pct = growthPct(rate);
  return result;
}

/** Prefer API metrics, with a fallback during a staggered backend deployment. */
export function performanceReturnMetrics(performance: PortfolioPerformance): PortfolioReturnMetrics {
  if (performance.annualization_status !== undefined) {
    return {
      performance_days: performance.performance_days ?? 0,
      twr_return_pct: performance.twr_return_pct ?? null,
      cash_return: performance.cash_return ?? null,
      cash_return_pct: performance.cash_return_pct ?? null,
      money_weighted_return_pct: performance.money_weighted_return_pct ?? null,
      money_weighted_return_annualized_pct: performance.money_weighted_return_annualized_pct ?? null,
      annualized_twr_return_pct: performance.annualized_twr_return_pct ?? null,
      annualization_status: performance.annualization_status,
    };
  }
  return calculateReturnMetrics({
    initialCapital: performance.initial_capital,
    finalNav: performance.final_nav,
    startDate: performance.start_date,
    endDate: performance.end_date,
    twrReturnPct: performance.total_return_pct,
    contributions: performance.series.map((point) => ({ date: point.date, amount: point.capital_contribution ?? 0 })),
  });
}
