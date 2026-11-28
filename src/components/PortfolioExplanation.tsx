import { AlertTriangle, ChevronDown, Layers3, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ExplanationMetric, PortfolioData } from "@/types";
import { explanationBody, formatExplanationMetric, legacyExplanationMetrics, legacyStockExplanations, stockMetricReading } from "@/lib/portfolioExplanation";

function MetricPill({ metric }: { metric: ExplanationMetric }) {
  return <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-lg bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
    <span>{metric.label.split(" · ")[0]}</span>
    <span className="font-semibold tabular-nums">{formatExplanationMetric(metric)}</span>
  </span>;
}

export default function PortfolioExplanation({ portfolio, children }: { portfolio: PortfolioData; children?: ReactNode }) {
  const stored = portfolio.rebalance_diagnostics?.explanation;
  const explanation = stored?.version === "portfolio_explanation_v1" || stored?.version === "portfolio_explanation_v2" ? stored : undefined;
  const metrics = explanation?.portfolio_metrics ?? legacyExplanationMetrics(portfolio);
  const stockNotes = (explanation?.stocks ?? legacyStockExplanations(portfolio)).map(stock => ({
    ...stock,
    description: explanationBody(stock.description),
    metrics: stock.metrics.map(metric => ({ ...metric, meaning: explanation?.version === "portfolio_explanation_v1"
      ? stockMetricReading(metric, stock.ticker) : explanationBody(metric.meaning) })),
  }));
  const lookup = new Map(metrics.map(metric => [metric.id, metric]));
  const period = explanation?.period;
  const diagnostics = portfolio.rebalance_diagnostics;
  const source = diagnostics?.narrative_source === "openai" || diagnostics?.narrative_source === "groq"
    ? "Penjelasan AI berdasarkan hasil perhitungan" : "Penjelasan berdasarkan hasil perhitungan";
  const primaryMetrics = ["max_drawdown", "correlation", "sharpe"]
    .flatMap(id => lookup.has(id) ? [lookup.get(id)!] : []);
  const risks = (explanation?.risks ?? []).map(explanationBody).filter(Boolean);
  const limitations = [...(explanation?.limitations ?? [])];
  if (diagnostics?.fitness_excludes_frozen_outside_universe && !limitations.some(text => /belum tercakup|belum mewakili/.test(text))) {
    limitations.push("Posisi di luar kandidat yang datanya belum memadai tidak tercakup dalam penilaian risiko ini.");
  }
  if (portfolio.holdings_edited) limitations.push("Kepemilikan telah diedit. Penjelasan dan metrik ini tetap mengacu pada hasil optimasi awal, sehingga belum menggambarkan komposisi setelah edit.");
  const stockCautions = explanation?.version === "portfolio_explanation_v1"
    ? stockNotes.flatMap(stock => {
      const note = explanationBody(stock.watchout);
      return note ? [`${stock.ticker}: ${note}`] : [];
    }) : [];
  const seenNotes = new Set<string>();
  const notes = [...risks, ...stockCautions, ...limitations].filter(note => {
    const normalized = note.toLocaleLowerCase("id-ID");
    const key = normalized.includes("kas") || (normalized.includes("hampir seluruh") && normalized.includes("modal"))
      ? "exposure" : normalized;
    if (seenNotes.has(key)) return false;
    seenNotes.add(key);
    return true;
  });

  return <section aria-label="Penjelasan kombinasi portofolio" className="space-y-6">
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        <span>{source}</span>
        {period?.mulai && period.akhir && <span>· Data historis {period.mulai}–{period.akhir}</span>}
        {!period?.mulai && explanation?.as_of && <span>· Acuan {explanation.as_of.slice(0, 10)}</span>}
      </div>
      <p className="max-w-4xl text-sm leading-relaxed text-foreground">
        {explanation ? explanationBody(explanation.summary) : "GA menilai kombinasi saham beserta pembagian dananya secara bersama. Metrik berikut membantu membaca hasil historis dan risiko kombinasi pada saat analisis."}
      </p>
    </div>

    {!!primaryMetrics.length && <div className="grid min-w-0 gap-3 md:grid-cols-3" aria-label="Metrik utama saat analisis">
      {primaryMetrics.map(metric => <div key={metric.id} className="min-w-0 rounded-xl border border-border bg-background/70 p-4">
        <h3 className="text-xs font-medium text-muted-foreground">{metric.label}</h3>
        <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-foreground">{formatExplanationMetric(metric)}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{explanation?.version === "portfolio_explanation_v1"
          ? legacyExplanationMetrics(portfolio).find(item => item.id === metric.id)?.meaning ?? explanationBody(metric.meaning)
          : metric.meaning}</p>
      </div>)}
    </div>}

    {!!explanation?.reasons.length && <section aria-label="Pertimbangan kombinasi" className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold"><Layers3 className="size-4 text-primary" aria-hidden="true" />Pertimbangan kombinasi portofolio</h3>
      <ul className="grid gap-3 lg:grid-cols-3">
        {explanation.reasons.map((reason, index) => <li key={`${reason.title}-${index}`} className="min-w-0 space-y-2 border-l-2 border-primary/30 pl-4">
          <h4 className="text-sm font-semibold text-foreground">{reason.title}</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{explanationBody(reason.explanation)}</p>
          <div className="flex flex-wrap gap-1.5">{reason.metric_ids.flatMap(id => {
            const metric = lookup.get(id);
            return metric ? [<MetricPill key={id} metric={metric} />] : [];
          })}</div>
        </li>)}
      </ul>
    </section>}

    {!explanation && portfolio.narasi_llm?.trim() && <section aria-label="Penjelasan tersimpan" className="space-y-3">
      <h3 className="text-base font-semibold">Penjelasan tersimpan</h3>
      <div className="space-y-3">{portfolio.narasi_llm.split(/\n\s*\n/).map(explanationBody).filter(Boolean).map((paragraph, index) =>
        <p key={index} className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{paragraph}</p>)}</div>
    </section>}

    {!!stockNotes.length && <section aria-label="Karakter saham dalam portofolio" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Kenali saham di dalamnya</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">Buka saham untuk memahami arti nilainya: harga terhadap laba, kemampuan menghasilkan laba, struktur pendanaan, dan dividen sesuai data yang tersedia.</p>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {stockNotes.map(stock => <details key={stock.ticker} className="group min-w-0 rounded-xl border border-border bg-background/60">
          <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold text-foreground">{stock.ticker}</span>
                {stock.weight != null && Number.isFinite(stock.weight) && <span className="text-xs text-muted-foreground">
                  Porsi {stock.weight_basis === "stock_basket" ? "dana saham" : "modal"} <span className="font-medium tabular-nums text-foreground">{formatExplanationMetric({ id: "weight", label: "Porsi", value: stock.weight, unit: "percent", meaning: "" })}</span>
                </span>}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{stock.description}</p>
              <div className="flex flex-wrap gap-1.5">{stock.metrics.slice(0, 2).map(metric => <MetricPill key={metric.id} metric={metric} />)}</div>
              <span className="text-xs font-medium text-primary group-open:hidden">Lihat penjelasan metrik</span>
              <span className="hidden text-xs font-medium text-primary group-open:inline">Tutup penjelasan</span>
            </div>
            <ChevronDown aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
            {stock.metrics.length ? <dl className="space-y-4">{stock.metrics.map(metric => <div key={metric.id}>
              <dt className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs font-semibold text-foreground"><span>{metric.label}</span><span className="tabular-nums">{formatExplanationMetric(metric)}</span></dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.meaning}</dd>
            </div>)}</dl> : <p className="text-xs text-muted-foreground">Data fundamental belum tersedia untuk saham ini.</p>}
          </div>
        </details>)}
      </div>
    </section>}

    {explanation?.conclusion && <section aria-label="Kesimpulan portofolio" className="space-y-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Gambaran akhirnya</h3>
      <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">{explanationBody(explanation.conclusion)}</p>
    </section>}
    {children}
    <section aria-label="Catatan risiko dan batasan" className="space-y-3 rounded-xl border border-amber-300/60 bg-amber-100/40 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />Catatan risiko dan batasan</h3>
      {!!notes.length && <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
      <p className="text-xs leading-relaxed">{explanation?.disclaimer ?? "Kinerja historis bukan jaminan hasil mendatang atau batas kerugian."} Metrik merekam kondisi saat analisis. Karakter per saham menjelaskan isi portofolio, bukan alasan kausal pemilihannya oleh GA.</p>
    </section>
  </section>;
}
