import type { PortfolioData, PortfolioMode } from "../types/index.ts";
import type { PortfolioSeries } from "./portfolioSeries.ts";

/** Historical viewing never changes the latest positions that actions manage. */
export function portfolioManagementTarget(
  selected: PortfolioData | null,
  series: PortfolioSeries | null,
  mode: PortfolioMode,
): PortfolioData | null {
  if (!selected) return null;
  const verifiedSeries = series?.snapshots.some((snapshot) => snapshot.id === selected.id) ? series : null;
  const active = mode === "live" ? "active" : "active_backtest";
  const replaced = mode === "live" ? "replaced" : "replaced_backtest";
  if (verifiedSeries) {
    const latest = verifiedSeries.latest;
    return latest.status_portofolio === active || latest.status_portofolio === replaced ? latest : null;
  }
  // If history failed to load, only the known active snapshot is actionable.
  return selected.status_portofolio === active ? selected : null;
}
