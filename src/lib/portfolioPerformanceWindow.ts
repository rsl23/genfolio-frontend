import type { PortfolioData, PortfolioPerformance } from "@/types";
import { calculateReturnMetrics } from "./portfolioReturnMetrics.ts";
import { groupRebalanceSteps } from "./rebalanceSteps.ts";

export interface PortfolioPerformanceWindow {
  data: PortfolioPerformance;
  isSegment: boolean;
  nextExecutionDate: string | null;
  /** Match the requested snapshot to the same date window sent for evaluation. */
  evaluationPortfolioId: string;
}

const snapshotDay = (snapshot: PortfolioData) =>
  (snapshot.execution_date || snapshot.date_ref || snapshot.created_at).slice(0, 10);

/** One decision period includes its delayed executions; overall covers the full ledger. */
export function selectPerformanceWindow(
  full: PortfolioPerformance,
  snapshots: PortfolioData[],
  selectedId: string,
  scope: "period" | "overall" = "period",
): PortfolioPerformanceWindow {
  const overallWindow = {
    data: full, isSegment: false, nextExecutionDate: null,
    evaluationPortfolioId: snapshots.at(-1)?.id ?? selectedId,
  };
  if (scope === "overall") return overallWindow;
  const steps = groupRebalanceSteps(snapshots);
  const index = steps.findIndex(step => step.snapshots.some(snapshot => snapshot.id === selectedId));
  if (index < 0) return overallWindow;
  if (index === 0 && steps.length === 1) {
    return { data: full, isSegment: true, nextExecutionDate: null, evaluationPortfolioId: selectedId };
  }

  const start = snapshotDay(steps[index].initial);
  const nextExecutionDate = steps[index + 1] ? snapshotDay(steps[index + 1].initial) : null;
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
  const startDate = first?.date.slice(0, 10) ?? start;
  const endDate = last?.date.slice(0, 10) ?? start;
  const metrics = calculateReturnMetrics({
    initialCapital: firstNav,
    finalNav: lastNav,
    startDate,
    endDate,
    twrReturnPct: finalReturn === null ? null : finalReturn * 100,
    // Opening NAV already includes any deposit on the first selected day.
    contributions: windowPoints.slice(1).map((point) => ({
      date: point.date, amount: point.capital_contribution ?? 0,
    })),
  });

  return {
    isSegment: true,
    nextExecutionDate,
    evaluationPortfolioId: selectedId,
    data: {
      ...full,
      ...metrics,
      start_date: startDate,
      requested_start_date: start,
      start_date_adjusted: first ? first.date.slice(0, 10) > start : false,
      end_date: endDate,
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
