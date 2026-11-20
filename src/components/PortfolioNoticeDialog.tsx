import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function PortfolioNoticeDialog({ onAccept, onClose }: {
  onAccept: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby="portfolio-notice-title"
      aria-describedby="portfolio-notice-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/60">
      <h2 id="portfolio-notice-title" className="text-lg font-semibold">
        Sebelum membuat portofolio
      </h2>
      <div id="portfolio-notice-description" className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
        <p>Live dan backtest menggunakan asumsi biaya transaksi yang sama. Fee broker, pajak, dan
          selisih harga eksekusi (slippage) aktual dapat berbeda. Sesuaikan modal
          yang dialokasikan dengan biaya transaksi Anda.</p>
        <p>Setoran tambahan menjadi kas yang tersedia saat rebalance dijalankan.
          Dana digunakan sesuai alokasi portofolio yang dipilih.</p>
        <p>Portofolio live langsung mengikuti hasil GA menggunakan harga acuan yang tersedia.
          Sesuaikan lot dan average beli di MyPortfolio dengan catatan sekuritas Anda.
          Perubahan lot menyesuaikan kas pada harga acuan; average beli mengoreksi
          dasar perhitungan laba/rugi.</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Kembali</Button>
        <Button onClick={onAccept}>Oke, saya mengerti</Button>
      </div>
    </dialog>
  );
}
