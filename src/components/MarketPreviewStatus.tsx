import { LoaderCircle } from "lucide-react";

export default function MarketPreviewStatus() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-800/15 bg-emerald-50/70 p-4 text-sm text-emerald-950">
      <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin text-emerald-700 motion-reduce:animate-none" />
      <div>
        <p className="font-semibold">Memeriksa kondisi pasar</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-900/70">Setelah pemeriksaan selesai, Anda dapat memilih alokasi saham dan kas. Analisis portofolio dimulai setelah Anda mengonfirmasi pilihan.</p>
      </div>
    </div>
  );
}
