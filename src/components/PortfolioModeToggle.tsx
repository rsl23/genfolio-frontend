import { Button } from "@/components/ui/button";
import { Activity, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioMode } from "@/types";

interface PortfolioModeToggleProps {
  /** Mode yang sedang aktif. */
  mode: PortfolioMode;
  /** Dipanggil saat user memilih mode lain. */
  onChange: (mode: PortfolioMode) => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: { value: PortfolioMode; label: string; icon: typeof Activity }[] =
  [
    { value: "live", label: "Live", icon: Activity },
    { value: "backtest", label: "Backtest", icon: FlaskConical },
  ];

/**
 * Tombol segmented untuk berpindah antara program LIVE dan BACKTEST.
 * Dipakai di halaman Rekomendasi Baru dan Portofolio Saya agar keduanya
 * memakai kontrol yang sama.
 */
export default function PortfolioModeToggle({
  mode,
  onChange,
  disabled = false,
  className,
}: PortfolioModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Pilih mode program (Live atau Backtest)"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-card p-1 shadow-xs",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = mode === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={isActive ? "default" : "ghost"}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 gap-1.5 px-3",
              isActive
                ? opt.value === "backtest"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-blue-600 hover:bg-blue-700"
                : "text-slate-600",
            )}
          >
            <Icon className="w-4 h-4" />
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
