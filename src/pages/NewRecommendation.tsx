import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Activity, ArrowLeft } from "lucide-react";
import type { FormData, RiskProfile } from "@/types";
import questionsData from "@/data/questions.json";

type QuestionType = "number" | "radio";

interface Option {
  value: string;
  label: string;
  score?: number;
}

interface Question {
  id: string;
  type: QuestionType;
  stepLabel: string;
  title: string;
  subtitle: string;
  prefix?: string;
  placeholder?: string;
  options?: Option[];
}

const questionnaireJson = questionsData as Question[];

export default function NewRecommendation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    capital: "", // inisialisasi default agar selalu ada untuk type safety
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = questionnaireJson.length;
  const currentQuestion = questionnaireJson[step];

  // Logic perhitungan dinamis berdasarkan total skor radio button
  const calculateRiskProfile = (): RiskProfile => {
    let totalScore = 0;
    let maxPossibleScore = 0;

    questionnaireJson.forEach((q) => {
      if (q.type === "radio" && q.options) {
        // Cari nilai maksimal skor dari pertanyaan ini
        const maxScoreForQuestion = Math.max(
          ...q.options.map((o) => o.score || 0),
        );
        maxPossibleScore += maxScoreForQuestion;

        // Cari skor jawaban user
        const selectedOption = q.options.find((o) => o.value === answers[q.id]);
        if (selectedOption && selectedOption.score !== undefined) {
          totalScore += selectedOption.score;
        }
      }
    });

    if (maxPossibleScore === 0) return "Konservatif"; // Fallback

    const scorePercentage = totalScore / maxPossibleScore;

    if (scorePercentage <= 0.33) return "Konservatif";
    if (scorePercentage <= 0.66) return "Moderat";
    return "Agresif";
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    // Simulate AI / GA processing time
    setTimeout(() => {
      setIsSubmitting(false);
      const riskProfile = calculateRiskProfile();
      navigate("/portfolio", {
        state: { formData: answers as FormData, riskProfile },
      });
    }, 2000);
  };

  const isCurrentStepValid = () => {
    const val = answers[currentQuestion.id];
    return val !== undefined && val.trim() !== "";
  };

  return (
    <div className="min-h-full bg-white rounded-2xl shadow-sm border p-4 md:p-8 lg:p-12">
      <div className="max-w-3xl mx-auto">
        {/* Header Steps Dinamis */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Mulai Rekomendasi Baru
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {questionnaireJson.map((q, idx) => (
              <div key={q.id} className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full ${step >= idx ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}
                >
                  {idx + 1}. {q.stepLabel}
                </span>
                {idx < totalSteps - 1 && (
                  <span className="text-slate-300">/</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-slate-50 border rounded-2xl p-6 md:p-10 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div className="flex-1">
            <div
              key={currentQuestion.id}
              className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500"
            >
              <div>
                <h2 className="text-2xl font-semibold mb-3">
                  {currentQuestion.title}
                </h2>
                <p className="text-slate-500 mb-8 text-lg">
                  {currentQuestion.subtitle}
                </p>

                {/* RENDER NUMBER INPUT */}
                {currentQuestion.type === "number" && (
                  <div className="max-w-md">
                    <Label className="text-base mb-3 block">Nominal</Label>
                    <div className="relative">
                      {currentQuestion.prefix && (
                        <span className="absolute left-4 top-3.5 text-slate-500 font-medium">
                          {currentQuestion.prefix}
                        </span>
                      )}
                      <Input
                        // 1. Ubah type menjadi text, tambahkan inputMode agar keyboard HP tetap memunculkan angka
                        type="text"
                        inputMode="numeric"
                        placeholder={currentQuestion.placeholder}
                        className={`text-xl h-14 bg-white ${currentQuestion.prefix ? "pl-12" : "pl-4"}`}
                        // 2. Format nilai yang diambil dari state agar memiliki titik
                        value={
                          answers[currentQuestion.id]
                            ? new Intl.NumberFormat("id-ID").format(
                                Number(answers[currentQuestion.id]),
                              )
                            : ""
                        }
                        onChange={(e) => {
                          // 3. Bersihkan semua karakter selain angka (menghapus titik saat diketik)
                          const rawValue = e.target.value.replace(/\D/g, "");

                          // 4. Simpan nilai mentahnya (integer/string angka) ke state, bukan nilai bertitiknya
                          setAnswers({
                            ...answers,
                            [currentQuestion.id]: rawValue,
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* RENDER RADIO INPUT */}
                {currentQuestion.type === "radio" &&
                  currentQuestion.options && (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ""}
                      onValueChange={(val) =>
                        setAnswers({ ...answers, [currentQuestion.id]: val })
                      }
                      className="space-y-4 max-w-xl"
                    >
                      {currentQuestion.options.map((opt, idx) => {
                        const radioId = `${currentQuestion.id}-opt-${idx}`;
                        return (
                          <div
                            key={opt.value}
                            className="flex items-center space-x-3 bg-white border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                          >
                            <RadioGroupItem
                              value={opt.value}
                              id={radioId}
                              className="w-5 h-5"
                            />
                            <Label
                              htmlFor={radioId}
                              className="cursor-pointer w-full text-base font-medium"
                            >
                              {opt.label}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  )}
              </div>
            </div>
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
              disabled={!isCurrentStepValid() || isSubmitting}
              className="w-full sm:w-auto h-12 px-8 text-base bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-spin" /> Menjalankan
                  Algoritma Genetika...
                </span>
              ) : step === totalSteps - 1 ? (
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
