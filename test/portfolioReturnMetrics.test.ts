import assert from "node:assert/strict";
import test from "node:test";
import { calculateReturnMetrics, performanceReturnMetrics } from "../src/lib/portfolioReturnMetrics.ts";
import { selectPerformanceWindow } from "../src/lib/portfolioPerformanceWindow.ts";
import type { PerformancePoint, PortfolioData, PortfolioPerformance } from "../src/types/index.ts";

const metric = (changes = {}) => calculateReturnMetrics({
  initialCapital: 100, finalNav: 121, startDate: "2021-01-01", endDate: "2023-01-01",
  twrReturnPct: 21, contributions: [], ...changes,
});
const close = (actual: number | null | undefined, expected: number) => {
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`);
};

test("compound annual average and late deposits match the backend examples", () => {
  close(metric().annualized_twr_return_pct, 10);
  const result = metric({ finalNav: 231, contributions: [{ date: "2022-01-01", amount: 100 }] });
  close(result.cash_return_pct, 15.5);
  close(result.money_weighted_return_pct, 21);
  close(result.money_weighted_return_annualized_pct, 10);
});

test("short histories show period MWR but suppress annualization", () => {
  const result = metric({ endDate: "2021-07-01", finalNav: 110, twrReturnPct: 10 });
  close(result.money_weighted_return_pct, 10);
  assert.equal(result.annualized_twr_return_pct, null);
  assert.equal(result.money_weighted_return_annualized_pct, null);
  assert.equal(result.annualization_status, "insufficient_history");
});

test("losses, missing data and impossible XIRR remain explicit", () => {
  close(metric({ finalNav: 81, twrReturnPct: -19 }).money_weighted_return_annualized_pct, -10);
  assert.equal(metric({ finalNav: null, twrReturnPct: null }).cash_return_pct, null);
  assert.equal(metric({ finalNav: 0, twrReturnPct: -100 }).annualized_twr_return_pct, -100);
  assert.equal(metric({ finalNav: 50, contributions: [{ date: "2023-01-01", amount: 100 }] }).money_weighted_return_pct, null);
});

test("deposits alone are not profits and a final-day deposit has no growth", () => {
  const flat = metric({ finalNav: 300, twrReturnPct: 0, contributions: [
    { date: "2021-04-01", amount: 100 }, { date: "2022-03-01", amount: 100 },
  ] });
  close(flat.cash_return, 0);
  close(flat.money_weighted_return_pct, 0);
  close(metric({ finalNav: 221, contributions: [{ date: "2023-01-01", amount: 100 }] }).money_weighted_return_annualized_pct, 10);
});

test("same-day, leap year and 365-day boundary use elapsed UTC days", () => {
  assert.equal(metric({ endDate: "2021-01-01" }).money_weighted_return_pct, null);
  assert.equal(metric({ startDate: "2020-01-01", endDate: "2020-12-30" }).annualized_twr_return_pct, null);
  close(metric({ startDate: "2020-01-01", endDate: "2020-12-31" }).annualized_twr_return_pct, 21);
});

const points = [
  { date: "2021-01-01", portfolio_value: 100, portfolio_return: 0, total_contributions: 0, capital_contribution: 0 },
  { date: "2022-01-01", portfolio_value: 210, portfolio_return: .1, total_contributions: 100, capital_contribution: 100 },
  { date: "2023-01-01", portfolio_value: 231, portfolio_return: .21, total_contributions: 100, capital_contribution: 0 },
] as PerformancePoint[];
const full = {
  start_date: "2021-01-01", end_date: "2023-01-01", initial_capital: 100,
  final_nav: 231, total_return_pct: 21, series: points,
  ...metric({ finalNav: 231, contributions: [{ date: "2022-01-01", amount: 100 }] }),
} as PortfolioPerformance;
const snapshots = [
  { id: "root", execution_date: "2021-01-01" },
  { id: "rebalance", execution_date: "2022-01-01" },
] as PortfolioData[];

test("a selected rebalance resets all metrics and does not count opening deposit twice", () => {
  const window = selectPerformanceWindow(full, snapshots, "rebalance").data;
  close(window.cash_return, 21);
  close(window.cash_return_pct, 10);
  close(window.money_weighted_return_pct, 10);
  close(window.annualized_twr_return_pct, 10);
  assert.equal(window.performance_days, 365);
  assert.equal(window.total_contributions, 0);
});

test("a short root period must not inherit overall annualization or cash return", () => {
  const window = selectPerformanceWindow(full, snapshots, "root").data;
  assert.equal(window.performance_days, 0);
  assert.equal(window.cash_return, 0);
  assert.equal(window.annualized_twr_return_pct, null);
  assert.equal(window.money_weighted_return_annualized_pct, null);
  assert.equal(selectPerformanceWindow(full, snapshots, "rebalance", "overall").data, full);
});

test("fallback supports old API responses while explicit API nulls stay null", () => {
  const old = { ...full, annualization_status: undefined };
  close(performanceReturnMetrics(old).money_weighted_return_annualized_pct, 10);
  assert.equal(performanceReturnMetrics({ ...full, money_weighted_return_pct: null }).money_weighted_return_pct, null);
});

test("evaluation of an early backtest period uses that snapshot instead of a future rebalance ID", () => {
  const history = [
    { id: "root-2025", execution_date: "2025-11-14" },
    { id: "middle-2025", execution_date: "2025-12-12" },
    { id: "latest-2026", execution_date: "2026-07-14" },
  ] as PortfolioData[];
  const performance = { ...full, start_date: "2025-11-14", end_date: "2026-08-13",
    series: ["2025-11-14", "2025-12-11", "2025-12-12", "2026-07-13", "2026-07-14", "2026-08-13"]
      .map(date => ({ ...full.series[0], date })),
  };
  for (const [selected, start, end] of [
    ["root-2025", "2025-11-14", "2025-12-11"],
    ["middle-2025", "2025-12-12", "2026-07-13"],
    ["latest-2026", "2026-07-14", "2026-08-13"],
  ]) {
    const window = selectPerformanceWindow(performance, history, selected, "period");
    assert.equal(window.evaluationPortfolioId, selected);
    assert.equal(window.data.start_date, start);
    assert.equal(window.data.end_date, end);
    const overall = selectPerformanceWindow(performance, history, selected, "overall");
    assert.equal(overall.evaluationPortfolioId, "latest-2026");
    assert.equal(overall.data, performance);
  }
});

test("single-snapshot and missing-selection windows keep evaluation identity consistent with displayed data", () => {
  assert.equal(selectPerformanceWindow(full, snapshots.slice(0, 1), "root").evaluationPortfolioId, "root");
  const fallback = selectPerformanceWindow(full, snapshots, "unknown");
  assert.equal(fallback.evaluationPortfolioId, snapshots.at(-1)?.id);
  assert.equal(fallback.data, full);
});
