import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BearChoice, BearMarketAssessment } from "@/types";

const keyFor = (item: BearMarketAssessment) =>
  item.scheduled_date ?? item.requested_date;

type BacktestPolicy = "always_follow" | "always_full" | "manual";

interface Props {
  assessments: BearMarketAssessment[];
  backtest?: boolean;
  capital?: number;
  busy: boolean;
  hidden?: boolean;
  error?: string | null;
  showNarrativeToggle?: boolean;
  onClose: () => void;
  onConfirm: (
    choices: Record<string, BearChoice>,
    generateLlmNarrative: boolean,
  ) => Promise<void>;
}

export default function BearMarketDialog({
  assessments,
  backtest = false,
  capital,
  busy,
  hidden = false,
  error,
  showNarrativeToggle = false,
  onClose,
  onConfirm,
}: Props) {
  const [choices, setChoices] = useState<Record<string, BearChoice>>({});
  const [policy, setPolicy] = useState<BacktestPolicy>("manual");
  const [generateLlmNarrative, setGenerateLlmNarrative] = useState(true);
  const manualChoices = !backtest || policy === "manual";
  const incomplete = manualChoices && assessments.some(
    (item) => choices[keyFor(item)] === undefined,
  ) || (backtest && policy === "always_follow" && assessments.some(
    (item) => item.recommended_fraction === null,
  ));
  const selectedChoices = (): Record<string, BearChoice> =>
    Object.fromEntries(assessments.map((item) => [
      keyFor(item),
      manualChoices ? choices[keyFor(item)] : policy === "always_full" ? "full" : "recommended",
    ])) as Record<string, BearChoice>;
  const currency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className={hidden ? "hidden" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saran kondisi pasar"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-xl font-semibold">Saran alokasi</h2>
        {backtest ? (
          <fieldset disabled={busy} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="mb-1 font-medium">Pilihan alokasi backtest ini</legend>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="backtest-bear-policy" checked={policy === "always_follow"}
                onChange={() => setPolicy("always_follow")} />
              Selalu ikuti saran
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="backtest-bear-policy" checked={policy === "always_full"}
                onChange={() => setPolicy("always_full")} />
              Selalu 100% modal
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="backtest-bear-policy" checked={policy === "manual"}
                onChange={() => setPolicy("manual")} />
              Manual per tanggal
            </label>
          </fieldset>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Pilih alokasi modal untuk rekomendasi ini.
          </p>
        )}
        {backtest && policy === "always_follow" && assessments.some((item) => item.recommended_fraction === null) && (
          <p className="mt-2 text-sm text-amber-800">
            Saran belum tersedia untuk semua tanggal. Pilih 100% modal atau manual per tanggal.
          </p>
        )}
        {assessments.some((item) => item.execution_date !== null) && (
          <p className="mt-2 text-xs text-amber-800">
            Pilihan untuk tanggal historis hanya simulasi.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {assessments.map((item) => {
            const key = keyFor(item);
            const fraction = item.recommended_fraction;
            return (
              <div key={key} className="rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 font-medium">
                  <span>
                    {item.scheduled_date ??
                      item.execution_date ??
                      item.requested_date}
                  </span>
                  <span>
                    {item.status === "bear"
                      ? "Sinyal bear"
                      : item.status === "normal"
                        ? "Normal"
                        : "Data tidak tersedia"}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{item.reason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Data {item.as_of ?? "tidak tersedia"}
                  {item.breadth_details?.fraction_below_ma != null &&
                    ` · ${(item.breadth_details.fraction_below_ma * 100).toFixed(1)}% saham di bawah MA${item.breadth_details.ma_sessions}`}
                </p>
                {fraction !== null && (
                  <div className="mt-2 rounded-lg bg-primary/5 px-3 py-2">
                    <p className="font-medium">
                      Saran: saham {(fraction * 100).toFixed(1)}% · kas{" "}
                      {((1 - fraction) * 100).toFixed(1)}%
                    </p>
                    {capital != null && (
                      <p className="text-xs text-slate-600">
                        {currency(capital * fraction)} saham ·{" "}
                        {currency(capital * (1 - fraction))} kas
                      </p>
                    )}
                  </div>
                )}
                {fraction === null && (
                  <p className="mt-2 text-amber-800">
                    Belum ada saran alokasi; pilih 100% untuk lanjut.
                  </p>
                )}
                {manualChoices ? <div className="mt-2 flex flex-wrap gap-4">
                    {fraction !== null && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          disabled={busy}
                          name={key}
                          checked={choices[key] === "recommended"}
                          onChange={() =>
                            setChoices((old) => ({
                              ...old,
                              [key]: "recommended",
                            }))
                          }
                        />
                        Ikuti saran
                      </label>
                    )}
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        disabled={busy}
                        name={key}
                        checked={choices[key] === "full"}
                        onChange={() =>
                          setChoices((old) => ({ ...old, [key]: "full" }))
                        }
                      />
                      Gunakan 100%
                    </label>
                </div> : (
                  <p className="mt-2 font-medium text-primary">
                    {policy === "always_full" ? "Pilihan: gunakan 100% modal." : "Pilihan: ikuti saran."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {showNarrativeToggle && (
          <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl border px-3 py-3 text-sm">
            <span>
              <span className="block font-medium">Narasi LLM</span>
              <span className="text-xs text-slate-600">
                Jika dimatikan, hasil rebalance menampilkan ringkasan dari GA.
              </span>
            </span>
            <span className="relative mt-0.5 inline-flex shrink-0">
              <input
                type="checkbox"
                role="switch"
                aria-label="Narasi LLM"
                className="peer sr-only"
                checked={generateLlmNarrative}
                onChange={(event) => setGenerateLlmNarrative(event.target.checked)}
                disabled={busy}
              />
              <span className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
              <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            onClick={() =>
              void onConfirm(selectedChoices(), generateLlmNarrative)
            }
            disabled={busy || incomplete}
          >
            {busy ? "Menjalankan..." : "Konfirmasi dan jalankan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
