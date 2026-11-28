import type { PortfolioData } from "@/types";

export interface RebalanceStep {
  initial: PortfolioData;
  snapshots: PortfolioData[];
}

/** Delayed fills belong to the originating decision, regardless of date distance. */
export function groupRebalanceSteps(snapshots: PortfolioData[]): RebalanceStep[] {
  const steps: RebalanceStep[] = [];
  for (const snapshot of snapshots) {
    const previous = steps.at(-1);
    if (snapshot.rebalance_diagnostics?.deferred_fill === true && previous &&
        snapshot.parent_portofolio_id === previous.snapshots.at(-1)?.id) {
      previous.snapshots.push(snapshot);
    } else {
      steps.push({ initial: snapshot, snapshots: [snapshot] });
    }
  }
  return steps;
}

export function deferredExecutions(step: RebalanceStep) {
  return step.snapshots.slice(1).flatMap(snapshot =>
    Object.entries(snapshot.rebalance_diagnostics?.execution_delta_lots ?? {})
      .filter(([, lots]) => Number.isFinite(lots) && lots !== 0)
      .map(([ticker, lots]) => ({
        key: `${snapshot.id}:${ticker}`,
        ticker,
        action: lots > 0 ? "dibeli" : "dijual",
        lots: Math.abs(lots),
        date: snapshot.execution_date?.slice(0, 10) ?? null,
        price: snapshot.execution_prices?.[ticker] ?? null,
      })),
  );
}
