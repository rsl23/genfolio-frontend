import { memo, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Activity, ArrowUpRight, Check, CheckCheck, Clock3, Database, Leaf, ScanLine, Sparkles } from "lucide-react";
import type { AnalysisProgressState, PortfolioProgressStore } from "@/lib/portfolioProgressStore";
import type { AnalysisStage } from "@/lib/portfolioProgress";

const steps: { stages: AnalysisStage[]; label: string; icon: typeof Database }[] = [
  { stages: ["preparing", "market"], label: "Data pasar", icon: Database },
  { stages: ["analyzing"], label: "Analisis saham", icon: ScanLine },
  { stages: ["optimizing"], label: "Optimasi", icon: Activity },
  { stages: ["allocating"], label: "Alokasi", icon: ArrowUpRight },
  { stages: ["narrative"], label: "Penjelasan", icon: Sparkles },
  { stages: ["saving"], label: "Hasil Anda", icon: CheckCheck },
];

const scoreFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4, minimumFractionDigits: 4 });
const largeScoreFormat = new Intl.NumberFormat("id-ID", { notation: "scientific", maximumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function elapsedLabel(seconds: number) {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.floor(seconds / 60)} menit ${seconds % 60} detik`;
}

const ScoreChart = memo(function ScoreChart({ scores }: { scores: AnalysisProgressState["scores"] }) {
  if (scores.length < 2) return (
    <div className="flex h-16 items-center justify-center gap-2 text-xs text-emerald-800/55">
      <Activity className="size-4" /> Grafik muncul setelah beberapa generasi
    </div>
  );
  const values = scores.map((point) => point.fitness);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const firstGeneration = scores[0].generation;
  const generationRange = scores.at(-1)!.generation - firstGeneration || 1;
  const points = scores.map((point) => `${8 + (point.generation - firstGeneration) / generationRange * 384},${68 - (point.fitness - min) / range * 52}`);
  return (
    <svg viewBox="0 0 400 80" className="h-16 w-full overflow-visible" role="img" aria-label="Perkembangan skor terbaik selama optimasi">
      {[16, 42, 68].map((y) => <line key={y} x1="8" x2="392" y1={y} y2={y} stroke="currentColor" className="text-emerald-900/10" strokeDasharray="3 5" />)}
      <polygon points={`8,80 ${points.join(" ")} 392,80`} fill="currentColor" className="text-emerald-600/10" />
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="text-emerald-600" />
      <circle cx="392" cy={points.at(-1)!.split(",")[1]} r="4" fill="currentColor" className="text-emerald-600" />
    </svg>
  );
});

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <span aria-label={`Waktu berjalan: ${elapsedLabel(seconds)}`} className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/70 px-2.5 py-1.5 text-[11px] tabular-nums text-emerald-900/65"><Clock3 className="size-3" />{label}</span>;
}

function ProgressFooter({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, updatedAt + 25001 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [updatedAt]);
  return <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-500">
    <Leaf aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
    <p>{now - updatedAt > 25000 ? "Kami masih menunggu pembaruan dari server. Tahap ini bisa memerlukan waktu lebih lama, terutama saat menyiapkan data atau menyusun penjelasan. Anda dapat menghentikan analisis melalui tombol di bawah." : "Anda dapat mengikuti prosesnya di sini atau menghentikan analisis melalui tombol di bawah."}</p>
  </div>;
}

export default function PortfolioProgressDialog({ store, preview = false, rebalance = false, onCancel }: {
  store: PortfolioProgressStore;
  preview?: boolean;
  rebalance?: boolean;
  onCancel?: () => void;
}) {
  const [stopping, setStopping] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { current, scores, activities } = state;
  const queued = current.stage === "queued";
  const active = queued ? -1 : Math.max(0, steps.findIndex((step) => step.stages.includes(current.stage)));
  const latestScore = current.fitness ?? scores.at(-1)?.fitness;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => event.preventDefault()}
      className="analysis-dialog fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/80 bg-[#fafbf6] p-0 text-slate-900 shadow-xl backdrop:bg-[#092b24]/65 sm:w-[calc(100%-3rem)]"
    >
      <div className="relative overflow-hidden border-b border-emerald-900/10 bg-[#eff5ec] px-6 pb-5 pt-6 sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full border border-emerald-900/[0.06]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 size-56 rounded-full border border-emerald-900/[0.06]" />
        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900/70">
            <Leaf className="size-4" /> <span>GenFolio</span> <span className="h-3 w-px bg-emerald-900/20" /> <span>Analisis<span className="hidden sm:inline"> personal</span></span>
          </div>
          <ElapsedTime startedAt={state.startedAt} />
        </div>
        <div className="relative flex items-center gap-5 sm:gap-7">
          <div aria-hidden="true" className="relative flex size-20 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-emerald-800/15" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-r-emerald-700/20 border-t-emerald-700" />
            <div className="absolute inset-2 rounded-full border border-dashed border-emerald-700/30" />
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#164e3d] text-[#d9edba] shadow-lg shadow-emerald-900/10 sm:size-14">
              {preview ? <ScanLine className="size-6" /> : <Sparkles className="size-6" />}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{preview ? "Sebelum kita mulai" : rebalance ? "Saatnya menata kembali" : "Dirancang sesuai profil Anda"}</p>
            <h2 id={titleId} className="font-heading text-[1.6rem] leading-tight tracking-tight text-[#173e32] sm:text-[1.8rem]">
              {queued ? "Menunggu giliran analisis" : preview ? "Mengenali kondisi pasar" : rebalance ? "Menata ulang portofolio Anda" : "Meracik portofolio Anda"}
            </h2>
            <p id={descriptionId} className="mt-2 max-w-md text-xs leading-relaxed text-emerald-950/60 sm:text-sm">
              {queued ? "Permintaan Anda sudah diterima. Biarkan halaman ini terbuka; analisis akan dimulai otomatis saat giliran tersedia." : preview ? "Sebentar, kami meninjau indikator pasar sebelum Anda menentukan alokasi modal." : "Dari data menjadi keputusan. Ikuti setiap langkah analisis yang sedang kami siapkan untuk Anda."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5 sm:px-8">
        {current.series_index != null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-900/[0.05] px-4 py-3 text-xs text-emerald-900">
            <span className="font-semibold">Jadwal rebalance {current.series_index} dari {current.series_total}</span>
            {current.series_date && <span>{dateFormat.format(new Date(`${current.series_date}T12:00:00`))}</span>}
          </div>
        )}
        {!preview && (
          <ol className="grid grid-cols-6 gap-1 sm:gap-2" aria-label="Tahapan analisis">
            {steps.map(({ label, icon: Icon }, index) => (
              <li key={label} aria-current={index === active ? "step" : undefined} className="min-w-0">
                <div className={`mb-2 h-1 rounded-full transition-colors duration-500 ${index <= active ? "bg-emerald-600" : "bg-emerald-900/10"}`} />
                <div className={`flex flex-col items-center gap-1.5 text-center text-[9px] leading-tight sm:flex-row sm:gap-1 sm:text-[10px] ${index === active ? "font-semibold text-emerald-800" : index < active ? "text-emerald-700" : "text-slate-400"}`}>
                  {index < active ? <Check className="size-3 shrink-0" /> : <Icon className="size-3 shrink-0" />}
                  {label}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div role="status" aria-live="polite" aria-atomic="true" className="rounded-2xl border border-emerald-800/10 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <span aria-hidden="true" className="inline-flex size-2 rounded-full bg-emerald-600" />
            {queued ? "Dalam antrean" : "Sedang dikerjakan"}
          </div>
          <h3 className="text-base font-semibold tracking-tight text-slate-800">{current.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{current.detail}</p>
        </div>

        {!preview && (current.generation != null || current.stage === "optimizing") && (
          <div className="rounded-2xl border border-emerald-900/10 bg-[#f0f6ed] px-4 pb-3 pt-4 sm:px-5">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-900/55">{current.stage === "optimizing" ? "Perkembangan optimasi" : "Hasil optimasi"}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-950">{current.generation != null ? `Generasi ${current.generation}` : "Menyiapkan generasi awal"}
                  {current.total_generations != null && <span className="ml-1 font-normal text-emerald-900/50">/ maks. {current.total_generations}</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-900/55">Skor kecocokan (fitness)</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-emerald-900">{latestScore != null && Number.isFinite(latestScore) ? (Math.abs(latestScore) >= 100000 ? largeScoreFormat : scoreFormat).format(latestScore) : "—"}</p>
              </div>
            </div>
            <ScoreChart scores={scores} />
            {current.generations_per_second != null && Number.isFinite(current.generations_per_second) && (
              <p className="mt-1 text-[10px] tabular-nums text-emerald-950/60">
                Kecepatan perhitungan: {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(current.generations_per_second)} generasi/detik
              </p>
            )}
            <p className="mt-2 border-t border-emerald-900/10 pt-2.5 text-[10px] leading-relaxed text-emerald-950/55">Skor untuk membandingkan kombinasi saham, bukan perkiraan keuntungan. Optimasi dapat selesai lebih awal saat hasil mulai stabil.</p>
          </div>
        )}

        {!preview && activities.length > 0 && (
          <div className="space-y-2 border-l border-emerald-900/10 pl-3">
            {activities.slice(-1).map((activity, index) => (
              <div key={`${activity.at}-${index}`} className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-2"><Check className="size-3 shrink-0 text-emerald-600/70" />{activity.title}</span>
                <span className="shrink-0 tabular-nums">{elapsedLabel(Math.max(0, Math.floor((activity.at - state.startedAt) / 1000)))}</span>
              </div>
            ))}
          </div>
        )}
        <ProgressFooter updatedAt={state.updatedAt} />
        {onCancel && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-900/10 pt-4">
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">{rebalance
            ? "Jadwal rebalance yang sudah selesai tetap tersimpan saat analisis dihentikan."
            : "Jika hasil sudah tersimpan, Anda dapat memeriksanya di riwayat portofolio."}</p>
          <button type="button" disabled={stopping}
            onClick={() => { setStopping(true); onCancel(); }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {stopping ? "Menghentikan analisis…" : "Hentikan analisis"}
          </button>
        </div>}
      </div>
    </dialog>
  );
}
