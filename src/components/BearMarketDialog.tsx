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
  hidden?: boolean;
  error?: string | null;
  askRebalanceMethod?: boolean;
  onClose: () => void;
  onConfirm: (
    policy: BearPolicy,
    choices: Record<string, BearChoice>,
    rebalanceMethod?: "legacy" | "composition_v2",
  ) => Promise<void>;
}

export default function BearMarketDialog({
  assessments,
  initialPolicy,
  capital,
  busy,
  hidden = false,
  error,
  askRebalanceMethod = false,
  onClose,
  onConfirm,
}: Props) {
  const [policy, setPolicy] = useState<BearPolicy>(initialPolicy);
  const [choices, setChoices] = useState<Record<string, BearChoice>>({});
  const [rebalanceMethod, setRebalanceMethod] = useState<"legacy" | "composition_v2" | null>(null);
  const required = assessments.filter(
    (item) =>
      policy === "manual" ||
      (policy === "always_follow" && item.status === "unknown"),
  );
  const incomplete = required.some(
    (item) => choices[keyFor(item)] === undefined,
  );
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
        <fieldset
          disabled={busy}
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
        >
          <legend className="mb-1 font-medium">Kebijakan akun</legend>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="bear-policy"
              checked={policy === "always_follow"}
              onChange={() => setPolicy("always_follow")}
            />
            Selalu ikuti saran
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="bear-policy"
              checked={policy === "always_full"}
              onChange={() => setPolicy("always_full")}
            />
            Selalu 100% modal
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="bear-policy"
              checked={policy === "manual"}
              onChange={() => setPolicy("manual")}
            />
            Pilih manual
          </label>
        </fieldset>
        {assessments.some((item) => item.execution_date !== null) &&
          policy === "manual" && (
            <p className="mt-2 text-xs text-amber-800">
              Pilihan untuk tanggal historis hanya simulasi.
            </p>
          )}
        <div className="mt-4 space-y-3">
          {assessments.map((item) => {
            const key = keyFor(item);
            const fraction = item.recommended_fraction;
            const needsChoice =
              policy === "manual" ||
              (policy === "always_follow" && item.status === "unknown");
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
                {policy === "always_full" && (
                  <p className="mt-2 font-medium text-primary">
                    Pilihan akun: gunakan 100% modal.
                  </p>
                )}
                {fraction === null && policy !== "always_full" && (
                  <p className="mt-2 text-amber-800">
                    Belum ada saran alokasi; pilih 100% untuk lanjut.
                  </p>
                )}
                {needsChoice && (
                  <div className="mt-2 flex flex-wrap gap-4">
                    {fraction !== null && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
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
                        name={key}
                        checked={choices[key] === "full"}
                        onChange={() =>
                          setChoices((old) => ({ ...old, [key]: "full" }))
                        }
                      />
                      Gunakan 100%
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {askRebalanceMethod && (
          <fieldset disabled={busy} className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <legend className="px-1 font-semibold">Metode untuk setiap rebalance</legend>
            <p className="mb-3 text-xs text-slate-600">
              Pilih sebelum menjalankan series. Pilihan ini berlaku untuk semua tanggal rebalance berikutnya; snapshot awal tetap seperti tersimpan.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input type="radio" name="series-rebalance-method" checked={rebalanceMethod === "legacy"}
                  onChange={() => setRebalanceMethod("legacy")} className="mt-1" />
                <span><strong>Legacy CVaR</strong> — fitness return, drawdown, dan CVaR yang saat ini digunakan.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="series-rebalance-method" checked={rebalanceMethod === "composition_v2"}
                  onChange={() => setRebalanceMethod("composition_v2")} className="mt-1" />
                <span><strong>Composition v2</strong> — fitness Legacy CVaR ditambah batas komposisi dan volatilitas relatif IHSG pada tiap rebalance.</span>
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Batas atas volatilitas porsi saham relatif IHSG: Konservatif 110%, Moderat 125%, Agresif 150%. Tidak ada minimum volatilitas, sehingga kombinasi yang lebih tenang tetap dapat dipilih. Dinilai pada setiap keputusan rebalance; hasil return dan risiko sepanjang backtest dapat berbeda. Kas ikut memengaruhi risiko total portofolio.
            </p>
          </fieldset>
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
              void onConfirm(
                policy,
                policy === "always_full"
                  ? Object.fromEntries(
                      assessments.map((item) => [
                        keyFor(item),
                        "full" as BearChoice,
                      ]),
                    )
                  : choices,
                askRebalanceMethod ? rebalanceMethod ?? undefined : undefined,
              )
            }
            disabled={busy || incomplete || (askRebalanceMethod && rebalanceMethod === null)}
          >
            {busy ? "Menjalankan..." : "Konfirmasi dan jalankan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
