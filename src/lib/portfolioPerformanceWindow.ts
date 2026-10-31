import type { PortfolioData, PortfolioPerformance } from "@/types";

export interface PortfolioPerformanceWindow {
  data: PortfolioPerformance;
  isSegment: boolean;
  nextExecutionDate: string | null;
}

const snapshotDay = (snapshot: PortfolioData) =>
  (snapshot.execution_date || snapshot.date_ref || snapshot.created_at).slice(0, 10);

/** Setiap snapshot = masa berlaku komposisinya; overall = seluruh rantai. */
export function selectPerformanceWindow(
  full: PortfolioPerformance,
  snapshots: PortfolioData[],
  selectedId: string,
  scope: "period" | "overall" = "period",
): PortfolioPerformanceWindow {
  if (scope === "overall") return { data: full, isSegment: false, nextExecutionDate: null };
  const index = snapshots.findIndex((snapshot) => snapshot.id === selectedId);
  if (index < 0) return { data: full, isSegment: false, nextExecutionDate: null };
  if (index === 0 && snapshots.length === 1) {
    return { data: full, isSegment: true, nextExecutionDate: null };
  }

  const start = snapshotDay(snapshots[index]);
  const nextExecutionDate = snapshots[index + 1] ? snapshotDay(snapshots[index + 1]) : null;
  const windowPoints = full.series.filter((point) => {
    const day = point.date.slice(0, 10);
    return day >= start && (!nextExecutionDate || day < nextExecutionDate);
  });
  const first = windowPoints[0];
  const last = windowPoints.at(-1);

  const relativeReturn = (current: number | null, baseline: number | null) => {
    if (current === null || baseline === null || 1 + baseline <= 0) return null;
    return (1 + current) / (1 + baseline) - 1;
  };
  const normalizedPoints = windowPoints.map((point, pointIndex) => ({
    ...point,
    daily_return: pointIndex === 0 ? null : point.daily_return,
    portfolio_return: relativeReturn(point.portfolio_return, first?.portfolio_return ?? null),
    ihsg_return: relativeReturn(point.ihsg_return, first?.ihsg_return ?? null),
  }));
  const firstNav = first?.portfolio_value ?? null;
  const lastNav = last?.portfolio_value ?? null;
  const contributions = (last?.total_contributions ?? 0) - (first?.total_contributions ?? 0);
  const finalReturn = normalizedPoints.at(-1)?.portfolio_return ?? null;

  return {
    isSegment: true,
    nextExecutionDate,
    data: {
      ...full,
      start_date: first?.date.slice(0, 10) ?? start,
      requested_start_date: start,
      start_date_adjusted: first ? first.date.slice(0, 10) > start : false,
      end_date: last?.date.slice(0, 10) ?? start,
      initial_capital: firstNav,
      total_contributions: contributions,
      final_nav: lastNav,
      net_investment_gain: firstNav !== null && lastNav !== null ? lastNav - firstNav - contributions : null,
      total_return_pct: finalReturn === null ? null : finalReturn * 100,
      realized_pnl: null,
      unrealized_pnl: null,
      missing_price_tickers: [],
      series: normalizedPoints,
    },
  };
}
