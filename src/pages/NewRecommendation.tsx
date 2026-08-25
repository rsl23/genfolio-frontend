import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Activity, ArrowLeft } from "lucide-react";
import type { FormData, RiskProfile } from "@/types";

export default function NewRecommendation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    capital: "",
    dropReaction: "",
    mainPriority: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateRiskProfile = (): RiskProfile => {
    let score = 0;
    if (formData.dropReaction === "c") score += 2;
    else if (formData.dropReaction === "b") score += 1;

    if (formData.mainPriority === "c") score += 2;
    else if (formData.mainPriority === "b") score += 1;

    if (score <= 1) return "Konservatif";
    if (score <= 3) return "Moderat";
    return "Agresif";
  };

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    // Simulate AI / GA processing time
    setTimeout(() => {
      setIsSubmitting(false);
      const riskProfile = calculateRiskProfile();
      navigate("/portfolio", { state: { formData, riskProfile } });
    }, 2000);
  };

  return (
    <div className="min-h-full bg-white rounded-2xl shadow-sm border p-4 md:p-8 lg:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header Steps */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Mulai Rekomendasi Baru
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={`px-3 py-1 rounded-full ${step >= 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}
            >
              1. Modal
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`px-3 py-1 rounded-full ${step >= 1 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}
            >
              2. Psikologi
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`px-3 py-1 rounded-full ${step >= 2 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}
            >
              3. Target
            </span>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-slate-50 border rounded-2xl p-6 md:p-10 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div className="flex-1">
            {step === 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-2xl font-semibold mb-3">
                    Kapasitas Modal Investasi
                  </h2>
                  <p className="text-slate-500 mb-8 text-lg">
                    Berapa total nominal dana yang siap Anda alokasikan untuk
                    portofolio ini secara keseluruhan?
                  </p>

                  <div className="max-w-md">
                    <Label className="text-base mb-3 block">
                      Nominal (Rupiah)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-slate-500 font-medium">
                        Rp
                      </span>
                      <Input
                        type="number"
                        placeholder="50.000.000"
                        className="pl-12 text-xl h-14 bg-white"
                        value={formData.capital}
                        onChange={(e) =>
                          setFormData({ ...formData, capital: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-2xl font-semibold mb-3">
                    Evaluasi Psikologi Risiko
                  </h2>
                  <p className="text-slate-500 mb-8 text-lg">
                    Jika nilai portofolio Anda tiba-tiba turun 15% dalam waktu
                    singkat akibat koreksi pasar, apa reaksi utama Anda?
                  </p>

                  <RadioGroup
                    value={formData.dropReaction}
                    onValueChange={(val) =>
                      setFormData({ ...formData, dropReaction: val })
                    }
                    className="space-y-4 max-w-xl"
                  >
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="a" id="r1a" className="w-5 h-5" />
                      <Label
                        htmlFor="r1a"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Jual semua untuk cegah rugi lebih dalam.
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="b" id="r1b" className="w-5 h-5" />
                      <Label
                        htmlFor="r1b"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Tahan (Hold) dan evaluasi fundamentalnya.
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="c" id="r1c" className="w-5 h-5" />
                      <Label
                        htmlFor="r1c"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Beli lebih banyak (Averaging Down).
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-2xl font-semibold mb-3">
                    Target & Tujuan Utama
                  </h2>
                  <p className="text-slate-500 mb-8 text-lg">
                    Apa prioritas utama Anda dalam berinvestasi di pasar modal
                    saat ini?
                  </p>

                  <RadioGroup
                    value={formData.mainPriority}
                    onValueChange={(val) =>
                      setFormData({ ...formData, mainPriority: val })
                    }
                    className="space-y-4 max-w-xl"
                  >
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="a" id="r2a" className="w-5 h-5" />
                      <Label
                        htmlFor="r2a"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Menjaga nilai uang dari inflasi (Aman).
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="b" id="r2b" className="w-5 h-5" />
                      <Label
                        htmlFor="r2b"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Pertumbuhan yang seimbang dan stabil.
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      <RadioGroupItem value="c" id="r2c" className="w-5 h-5" />
                      <Label
                        htmlFor="r2c"
                        className="cursor-pointer w-full text-base font-medium"
                      >
                        Memaksimalkan keuntungan (High Return).
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-between sm:items-center gap-4 mt-10 pt-6 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setStep(step > 0 ? step - 1 : 0)}
              disabled={step === 0 || isSubmitting}
              className="w-full sm:w-auto h-12 px-6 text-base"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>

            <Button
              onClick={handleNext}
              disabled={
                (step === 0 && !formData.capital) ||
                (step === 1 && !formData.dropReaction) ||
                (step === 2 && !formData.mainPriority) ||
                isSubmitting
              }
              className="w-full sm:w-auto h-12 px-8 text-base bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-spin" /> Menjalankan
                  Algoritma Genetika...
                </span>
              ) : step === 2 ? (
                <span className="flex items-center gap-2">
                  Selesaikan & Analisis <ArrowRight className="w-5 h-5" />
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Selanjutnya <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
