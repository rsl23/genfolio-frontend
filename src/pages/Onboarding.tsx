import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Briefcase, ArrowRight, Activity } from "lucide-react";
import type { FormData, RiskProfile } from "@/types";

export default function Onboarding() {
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
      // Navigate to dashboard with state
      navigate("/dashboard", { state: { formData, riskProfile } });
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg border-t-4 border-t-blue-600">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" />
            GenFolio
          </CardTitle>
          <CardDescription>
            Rekomendasi Portofolio Saham dengan Algoritma Genetika & LLM
          </CardDescription>
          <Progress value={(step / 2) * 100} className="mt-4 h-2" />
        </CardHeader>
        <CardContent className="min-h-[250px] mt-4">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Kapasitas Modal</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Berapa total nominal dana yang siap Anda alokasikan untuk
                  portofolio ini?
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">
                    Rp
                  </span>
                  <Input
                    type="number"
                    placeholder="50.000.000"
                    className="pl-9 text-lg"
                    value={formData.capital}
                    onChange={(e) =>
                      setFormData({ ...formData, capital: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Psikologi Investasi
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Jika nilai portofolio Anda tiba-tiba turun 15% dalam waktu
                  singkat akibat koreksi pasar, apa reaksi utama Anda?
                </p>
                <RadioGroup
                  value={formData.dropReaction}
                  onValueChange={(val) =>
                    setFormData({ ...formData, dropReaction: val })
                  }
                >
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="a" id="r1a" />
                    <Label htmlFor="r1a" className="cursor-pointer w-full">
                      Jual semua untuk cegah rugi lebih dalam.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="b" id="r1b" />
                    <Label htmlFor="r1b" className="cursor-pointer w-full">
                      Tahan (Hold) dan evaluasi fundamentalnya.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="c" id="r1c" />
                    <Label htmlFor="r1c" className="cursor-pointer w-full">
                      Beli lebih banyak (Averaging Down).
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Target Investasi</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Apa prioritas utama Anda dalam berinvestasi di pasar modal
                  saat ini?
                </p>
                <RadioGroup
                  value={formData.mainPriority}
                  onValueChange={(val) =>
                    setFormData({ ...formData, mainPriority: val })
                  }
                >
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="a" id="r2a" />
                    <Label htmlFor="r2a" className="cursor-pointer w-full">
                      Menjaga nilai uang dari inflasi (Aman).
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="b" id="r2b" />
                    <Label htmlFor="r2b" className="cursor-pointer w-full">
                      Pertumbuhan yang seimbang dan stabil.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-4 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="c" id="r2c" />
                    <Label htmlFor="r2c" className="cursor-pointer w-full">
                      Memaksimalkan keuntungan (High Return).
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6 bg-slate-50 rounded-b-xl">
          <Button
            variant="outline"
            onClick={() => setStep(step > 0 ? step - 1 : 0)}
            disabled={step === 0 || isSubmitting}
          >
            Kembali
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (step === 0 && !formData.capital) ||
              (step === 1 && !formData.dropReaction) ||
              (step === 2 && !formData.mainPriority) ||
              isSubmitting
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-spin" /> Memproses AI...
              </span>
            ) : step === 2 ? (
              <span className="flex items-center gap-2">
                Analisis Portofolio <ArrowRight className="w-4 h-4" />
              </span>
            ) : (
              "Selanjutnya"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
