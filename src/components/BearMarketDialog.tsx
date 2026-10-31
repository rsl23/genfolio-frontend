import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BearChoice, BearMarketAssessment, BearPolicy } from "@/types";

const keyFor = (item: BearMarketAssessment) =>
  item.scheduled_date ?? item.requested_date;

interface Props {
  assessments: BearMarketAssessment[];
  initialPolicy: BearPolicy;
  capital?: number;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (policy: BearPolicy, choices: Record<string, BearChoice>) => Promise<void>;
}

export default function BearMarketDialog({
  assessments, initialPolicy, capital, busy, error, onClose, onConfirm,
}: Props) {
  const [policy, setPolicy] = useState<BearPolicy>(initialPolicy);
  const [choices, setChoices] = useState<Record<string, BearChoice>>({});
  const required = assessments.filter(
    (item) => policy === "manual" || item.status === "unknown",
  );
  const incomplete = required.some((item) => choices[keyFor(item)] === undefined);
  const currency = (value: number) => new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-label="Saran kondisi pasar"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-xl font-semibold">Saran kondisi pasar sebelum eksekusi</h2>
        <p className="mt-2 text-sm text-slate-600">
          Kas yang tidak dibelikan saham tetap masuk NAV. Saran tidak menjamin return mengungguli IHSG.
        </p>
        <fieldset className="mt-4 rounded-xl border p-3">
          <legend className="px-1 font-medium">Kebijakan akun</legend>
          <label className="mr-5 inline-flex items-center gap-2 text-sm">
            <input type="radio" name="bear-policy" checked={policy === "always_follow"}
              onChange={() => setPolicy("always_follow")} />
            Selalu ikuti saran
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="bear-policy" checked={policy === "manual"}
              onChange={() => setPolicy("manual")} />
            Pilih manual
          </label>
        </fieldset>
        {assessments.some((item) => item.execution_date !== null) && policy === "manual" && (
          <p className="mt-3 text-sm text-amber-800">
            Pilihan manual untuk tanggal historis adalah simulasi what-if, bukan bukti performa tanpa hindsight.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {assessments.map((item) => {
            const key = keyFor(item);
            const fraction = item.recommended_fraction;
            const needsChoice = policy === "manual" || item.status === "unknown";
            return (
              <div key={key} className="rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 font-medium">
                  <span>{item.scheduled_date ?? item.execution_date ?? item.requested_date}</span>
                  <span>{item.status === "bear" ? "Bear market" :
                    item.status === "normal" ? "Normal" : "Data tidak tersedia"}</span>
                </div>
                <p className="mt-1 text-slate-600">
                  Data sampai {item.as_of ?? "tidak tersedia"}. {item.reason}
                </p>
                {item.severity !== null && (
                  <details className="mt-1 text-slate-600">
                    <summary className="cursor-pointer">
                      Severity {(item.severity * 100).toFixed(1)}% - aturan {item.config_version}
                    </summary>
                    <p>{item.formula}</p>
                    <p>Alokasi ({item.allocation_config_version}): {item.allocation_formula}</p>
                    <ul className="list-disc pl-5">
                      {Object.entries(item.components).map(([name, value]) => (
                        <li key={name}>{name}: {(value * 100).toFixed(1)}%
                          {" - bobot efektif "}{((item.effective_weights[name] ?? 0) * 100).toFixed(1)}%
                        </li>
                      ))}
                    </ul>
                    {item.missing_indicators.length > 0 && (
                      <p>Indikator tidak tersedia: {item.missing_indicators.join(", ")}.</p>
                    )}
                  </details>
                )}
                {fraction !== null && (
                  <p className="mt-1">
                    Saran saham {(fraction * 100).toFixed(1)}%, kas {((1 - fraction) * 100).toFixed(1)}%
                    {capital ? ` (sekitar ${currency(capital * fraction)} saham)` : ""}.
                  </p>
                )}
                {item.status === "unknown" && (
                  <p className="mt-1 text-amber-800">
                    Tidak ada saran porsi. Pilih full modal secara eksplisit atau batalkan.
                  </p>
                )}
                {needsChoice && (
                  <div className="mt-2 flex flex-wrap gap-4">
                    {fraction !== null && (
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name={key} checked={choices[key] === "recommended"}
                          onChange={() => setChoices((old) => ({ ...old, [key]: "recommended" }))} />
                        Ikuti saran
                      </label>
                    )}
                    <label className="inline-flex items-center gap-2">
                      <input type="radio" name={key} checked={choices[key] === "full"}
                        onChange={() => setChoices((old) => ({ ...old, [key]: "full" }))} />
                      Gunakan 100%
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
          <Button onClick={() => void onConfirm(policy, choices)} disabled={busy || incomplete}>
            {busy ? "Menjalankan..." : "Konfirmasi dan jalankan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
