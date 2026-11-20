import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { selectRiskEvaluationTarget } from "../src/lib/riskEvaluationPresentation.ts";

let server, views;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  views = await server.ssrLoadModule("/src/components/RiskEvaluationPanel.tsx");
});
after(async () => { await server?.close(); });
test("bear allocation comparison displays only the three risk metrics", async () => {
  const { BearImpactSummary } = await server.ssrLoadModule("/src/components/BearImpactPanel.tsx");
  const arm = { risk: { ...risk, drawdown: { ...risk.drawdown, recovered: false } },
    net_return_pct: 10, final_nav: 110, transaction_costs: 1, average_equity_pct: 60 };
  const html = render(BearImpactSummary, { result: { status: "available", start_date: "2020-01-02",
    end_date: "2020-12-30", recommended: arm, full: { ...arm, net_return_pct: 20 },
    verdict: "mixed_or_equal", bear_decisions: 1, differences: { return_difference_pp: -10 },
    assumptions: ["Keranjang saham GA sama; GA tidak dijalankan ulang."], decisions: [] } });
  assert.match(html, /Ikuti saran bear/);
  assert.match(html, /100% dana investasi ke saham/);
  assert.doesNotMatch(html, /Return bersih|biaya transaksi|Rata-rata porsi|Pemulihan|Downside deviation/);
  assert.match(html, /CVaR harian/);
  assert.match(html, /Hasil risiko bercampur/);
  assert.doesNotMatch(html, /NaN|undefined/);
});
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const risk = {
  portfolio_status: "available", profile: "Moderate", start_date: "2025-11-14", end_date: "2025-12-30",
  window_sessions: 63, minimum_capture_sessions: 20, profile_cap: 1, paired_sessions: 30, observations: 30,
  coverage_pct: 100, relative_volatility: 1, annualized_volatility_pct: 15, ihsg_annualized_volatility_pct: 15,
  compliance_pct: null, valid_windows: 0, eligible_windows: 0, latest_rolling_relative_volatility: null,
  latest_status: "insufficient_data", availability: { compliance: "insufficient_history", latest_window: "insufficient_history" },
  downside_capture: { pct: null, sessions: 15, status: "insufficient_directional_sessions" },
  upside_capture: { pct: null, sessions: 15, status: "insufficient_directional_sessions" },
  drawdown: { mdd_pct: 6.48, max_underwater_sessions: 12, current_underwater_sessions: 12,
    worst_recovery_sessions: null, recovered: false, worst_trough_date: "2025-12-15", status: "available" },
  notes: [], warnings: ["Stock split diagnostic that must stay out of the UI"], stock_basket_relative_volatility: 123.456,
  market_risk: { source: "ihsg_price_index", start_date: "2025-11-14", end_date: "2025-12-30",
    observations: 30, valid_sessions: 30, annualized_volatility_pct: 10.5, volatility_status: "available",
    drawdown: { mdd_pct: 8, max_underwater_sessions: 10, current_underwater_sessions: 0,
      worst_recovery_sessions: 5, recovered: true, status: "available" } },
};
test("primary risk always describes the portfolio, without substituting IHSG risk", () => {
  const html = render(views.RiskEvaluationSummary, { risk: { ...risk, portfolio_status: "simulation_estimate",
    simulation_notice: "Risiko dari NAV simulasi tersimpan." } });
  assert.match(html, /Risiko yang Anda alami/);
  assert.match(html, /Fluktuasi tahunan/);
  assert.match(html, /Penurunan terbesar/);
  assert.match(html, />15%<\/p>/);
  assert.match(html, />6,48%<\/p>/);
  assert.match(html, /Kesesuaian profil belum dapat dinilai/);
  assert.match(html, /NAV simulasi tersimpan/);
  assert.doesNotMatch(html, /Risiko pasar IHSG|Penurunan maksimum IHSG|Pemulihan IHSG|Stock split|corporate action|basis harga|keranjang saham/);
});

test("missing portfolio values are explained rather than replaced by benchmark metrics", () => {
  const html = render(views.RiskEvaluationSummary, { risk: { ...risk, annualized_volatility_pct: null,
    availability: { ...risk.availability, volatility: "incomplete_nav" },
    drawdown: { ...risk.drawdown, mdd_pct: null, status: "incomplete_nav" } } });
  assert.match(html, /Riwayat nilai belum lengkap/);
  assert.doesNotMatch(html, /Risiko pasar IHSG|Penurunan maksimum IHSG/);
});

test("the whole backtest is the default portfolio risk scope even when viewing an early snapshot", () => {
  const html = render(views.default, { portfolioId: "initial", startDate: "2020-11-27", endDate: "2020-12-24",
    overallPortfolioId: "latest", overallStartDate: "2020-11-27", overallEndDate: "2024-12-30",
    backtest: true, profile: "Moderat" });
  assert.match(html, /Periode penilaian risiko portofolio/);
  assert.match(html, /value="overall" selected=""/);
  assert.match(html, /Seluruh rangkaian backtest/);
  assert.match(html, /Portofolio dinilai pada 2020-11-27 – 2024-12-30/);
});

test("panel removes non-risk diagnostics and is absent in live mode", () => {
  const props = { portfolioId: "example", startDate: "2025-01-01", endDate: "2025-12-31", backtest: true, profile: "Moderat" };
  const html = render(views.default, props);
  assert.doesNotMatch(html, /precision|recall|Diagnostik label|Cakupan penilaian detector/);
  assert.equal(render(views.default, { ...props, backtest: false }), "");
});

test("profile assessment uses explicit experimental limits and preserves zero", () => {
  for (const status of ["within_limit", "above_limit"]) {
    const html = render(views.RiskEvaluationSummary, { risk: { ...risk,
      annualized_volatility_pct: 0, daily_cvar_95_pct: 0,
      profile_assessment: { status, actual_volatility_pct: 15, limit_volatility_pct: 12,
        minimum_sessions: 63, notice: "Batas eksperimen TA, bukan toleransi kerugian pribadi." } } });
    assert.match(html, status === "within_limit" ? /berada dalam batas/ : /melampaui batas/);
    assert.match(html, /portofolio 15%; batas profil Moderat 12%/);
    assert.match(html, />0%<\/p>/);
    assert.match(html, /bukan toleransi kerugian pribadi/);
    assert.doesNotMatch(html, /Downside capture|Upside capture|Jendela memenuhi|Durasi|Pemulihan|Downside deviation/);
  }
});

test("risk scope keeps snapshot identity and dates together to prevent the earlier 404", () => {
  const period = { portfolioId: "root", startDate: "2025-11-14", endDate: "2025-12-11" };
  const overall = { portfolioId: "latest", startDate: "2025-11-14", endDate: "2026-08-13" };
  assert.equal(selectRiskEvaluationTarget(period, overall, "overall"), overall);
  assert.equal(selectRiskEvaluationTarget(period, overall, "period"), period);
  assert.equal(selectRiskEvaluationTarget(period, null, "overall"), period);
});
