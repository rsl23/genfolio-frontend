import type { PortfolioNewsContextData } from "@/types";
import { useEffect, useState } from "react";
import { portofolioService } from "@/services/portofolioService";

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tanggal tidak tersedia" : date.toLocaleString("id-ID", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }) + " WIB";
};

function safeLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export default function PortfolioNewsContext({ news: savedNews, portfolioId }: {
  news?: PortfolioNewsContextData;
  portfolioId: string;
}) {
  const [news, setNews] = useState(savedNews);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || news || error) return;
    const controller = new AbortController();
    portofolioService.getPortfolioNews(portfolioId, controller.signal).then(setNews).catch(() => {
      if (!controller.signal.aborted) setError("Berita belum dapat dimuat.");
    });
    return () => controller.abort();
  }, [open, news, error, portfolioId]);
  if (news?.status === "disabled") return null;
  return <details className="border-t border-blue-100 pt-4" aria-label="Konteks berita emiten"
    onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
      Konteks berita emiten{news?.items.length ? ` · ${news.items.length} sumber` : ""}
    </summary>
    <div className="mt-3 space-y-3">
    {!news ? <p className="text-sm text-slate-600">
      {error || "Memuat berita emiten..."}
      {error && <button type="button" className="ml-2 underline" onClick={() => setError(null)}>Coba lagi</button>}
    </p> : <>
    <p className="text-sm leading-relaxed text-slate-600">
      Informasi tambahan di luar analisis utama. Berita ini tidak menjadi alasan pemilihan saham oleh GA.
    </p>
    {news.cutoff && <p className="text-xs leading-relaxed text-slate-500">
      Publikasi sebelum {dateLabel(news.cutoff)}. Jendela pencarian {news.lookback_days} hari.
    </p>}
    {news.items.length ? <>
      {news.items.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white/80 p-3">
        <p className="mb-1 text-xs font-medium text-blue-800">[{item.id}] · {item.ticker} · {item.source}</p>
        {safeLink(item.url)
          ? <a className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-blue-700"
              href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">{item.title}</a>
          : <p className="text-sm font-medium text-slate-900">{item.title}</p>}
        <p className="mt-1 text-xs text-slate-500">{dateLabel(item.published_at)}</p>
        {item.evidence_level === "excerpt" && item.summary && <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>}
        <p className="mt-2 text-xs text-slate-500">{item.evidence_level === "headline"
          ? "Bukti tersedia berupa judul terindeks; isi artikel dan dampaknya belum diverifikasi."
          : "Kutipan dari arsip yang disediakan."}</p>
      </article>)}
      <p className="text-xs leading-relaxed text-slate-500">{news.retrieval_partial
        ? "Sebagian sumber tidak dapat diakses. Berita yang ditampilkan belum mencakup seluruh peristiwa."
        : news.coverage} Tautan membuka halaman sumber yang mungkin telah diperbarui setelah tanggal simulasi.</p>
    </> : <p className="text-sm leading-relaxed text-slate-600">
      {news.reason || "Konteks berita historis belum tersedia untuk saham dan tanggal ini."} Ketiadaan hasil tidak berarti tidak ada peristiwa terkait.
    </p>}
    </>}
    </div>
  </details>;
}
