import type { PortfolioData, PortfolioMode } from "@/types";

export interface PortfolioSeries {
  root: PortfolioData;
  latest: PortfolioData;
  snapshots: PortfolioData[];
}

/** Satu kartu untuk setiap snapshot awal; rebalance menjadi anggota rangkaiannya. */
export function groupPortfolioSeries(portfolios: PortfolioData[], mode: PortfolioMode): PortfolioSeries[] {
  const byId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio]));
  const groups = new Map<string, PortfolioData[]>();

  for (const portfolio of portfolios) {
    const seen = new Set<string>();
    let current = portfolio;
    while (current.parent_portofolio_id) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      const parent = byId.get(current.parent_portofolio_id);
      if (!parent) break;
      current = parent;
    }
    // Snapshot tanpa induk yang tersedia tidak ditampilkan sebagai portofolio baru.
    if (current.parent_portofolio_id) continue;
    const snapshots = groups.get(current.id) ?? [];
    snapshots.push(portfolio);
    groups.set(current.id, snapshots);
  }

  const dateKey = (portfolio: PortfolioData) => mode === "backtest"
    ? (portfolio.execution_date || portfolio.date_ref || portfolio.created_at)
    : portfolio.created_at;

  return [...groups.entries()].map(([rootId, snapshots]) => {
    snapshots.sort((left, right) => dateKey(left).localeCompare(dateKey(right)) || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
    return { root: byId.get(rootId)!, latest: snapshots[snapshots.length - 1], snapshots };
  }).sort((left, right) => dateKey(right.latest).localeCompare(dateKey(left.latest)) || right.latest.created_at.localeCompare(left.latest.created_at));
}
