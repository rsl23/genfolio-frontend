import type { PortfolioMode } from "@/types";
import type { PortfolioSeries } from "@/lib/portfolioSeries";

export type PortfolioListSort = "date-desc" | "date-asc" | "return-desc" | "return-asc";

export function portfolioStartDate(item: PortfolioSeries, mode: PortfolioMode): string {
  const root = item.root;
  return (mode === "backtest"
    ? root.execution_date || root.date_ref || root.created_at
    : root.created_at).slice(0, 10);
}

export function portfolioTickers(item: PortfolioSeries): string[] {
  return [...new Set(item.snapshots.flatMap((snapshot) =>
    (snapshot.allocations ?? []).map((allocation) => allocation.ticker.toUpperCase()),
  ))].sort();
}

export function filterPortfolioSeries(
  items: PortfolioSeries[], mode: PortfolioMode, query: string, selectedTicker: string,
): PortfolioSeries[] {
  const needle = query.trim().toLocaleLowerCase("id-ID");
  return items.filter((item) => {
    const tickers = portfolioTickers(item);
    if (selectedTicker && !tickers.includes(selectedTicker.toUpperCase())) return false;
    if (!needle) return true;

    const day = portfolioStartDate(item, mode);
    const [year, month, date] = day.split("-");
    const parsedDay = new Date(`${day}T00:00:00`);
    const readableDates = Number.isNaN(parsedDay.getTime()) ? [] : [
      parsedDay.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      parsedDay.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    ];
    const dateTerms = [day, `${date}-${month}-${year}`, `${date}/${month}/${year}`,
      `${date}.${month}.${year}`, ...readableDates];
    const visibleName = item.root.name_portofolio?.trim() || `Portofolio ${item.root.risk_profile} ${day}`;
    const textTerms = [visibleName, item.root.description,
      item.root.risk_profile, ...tickers, ...dateTerms];
    return textTerms.some((value) => value?.toLocaleLowerCase("id-ID").includes(needle));
  });
}

export function sortPortfolioSeries(
  items: PortfolioSeries[], mode: PortfolioMode, sort: PortfolioListSort,
  returns: Record<string, number | null> = {},
): PortfolioSeries[] {
  return [...items].sort((left, right) => {
    if (sort.startsWith("return")) {
      const a = returns[left.root.id];
      const b = returns[right.root.id];
      const aValid = typeof a === "number" && Number.isFinite(a);
      const bValid = typeof b === "number" && Number.isFinite(b);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid && a !== b) {
        return sort === "return-desc" ? b - a : a - b;
      }
    }

    const dateOrder = portfolioStartDate(left, mode).localeCompare(portfolioStartDate(right, mode));
    if (dateOrder !== 0) return sort === "date-asc" ? dateOrder : -dateOrder;
    const timeOrder = left.root.created_at.localeCompare(right.root.created_at);
    if (timeOrder !== 0) return sort === "date-asc" ? timeOrder : -timeOrder;
    return left.root.id.localeCompare(right.root.id);
  });
}
