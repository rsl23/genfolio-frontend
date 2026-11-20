import type { FitnessPolicy } from "@/types";

export default function FitnessPolicySelect({ value, onChange, disabled = false }: {
  value: FitnessPolicy;
  onChange: (value: FitnessPolicy) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-900">
      <span>Penilaian portofolio · live dan backtest</span>
      <select className="w-full rounded-lg border border-input bg-card px-3 py-2"
        value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value as FitnessPolicy)}>
        <option value="legacy_cvar_v1">Fitness lama + penalti CVaR (gabungan)</option>
        <option value="legacy">Fitness lama (pembanding)</option>
      </select>
      <span className="block text-xs font-normal leading-relaxed text-slate-500">
        CVaR memakai minimal 189 sesi historis (3 blok × 63 sesi). Nilai nol berarti
        ekor skenario tidak menunjukkan kerugian. Jika histori belum cukup, pilih
        fitness legacy yang sama untuk kedua mode. Biaya beli 0,15% dan jual 0,25%.
      </span>
    </label>
  );
}
