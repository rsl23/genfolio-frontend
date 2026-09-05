import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Activity, ArrowLeft } from "lucide-react";
import type { FormData, RiskProfile } from "@/types";
import questionsData from "@/data/questions.json";
import { portofolioService } from "@/services/portofolioService";

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

/* ============================================================
   SISTEM SKORING PROFIL RISIKO
   ============================================================ */

// Pemetaan skor per kategori (berdasarkan id pertanyaan di questions.json)
const PSIKOLOGIS_IDS = ["dropReaction", "mainPriority"]; // Q1-Q2, rentang skor 2-6
const FINANSIAL_IDS = [
  "timeHorizon",
  "emergencyFund",
  "wealthProportion",
  "withdrawalLikelihood",
]; // Q3-Q6, rentang skor 4-12
const EXPERIENCE_ID = "experience"; // Q7, skor 1-3

/** Level dimensi Psikologis: 2-3 = L1, 4 = L2, 5-6 = L3 */
const levelPsikologis = (total: number): 1 | 2 | 3 =>
  total <= 3 ? 1 : total === 4 ? 2 : 3;

/** Level dimensi Finansial: 4-6 = L1, 7-9 = L2, 10-12 = L3 */
const levelFinansial = (total: number): 1 | 2 | 3 =>
  total <= 6 ? 1 : total <= 9 ? 2 : 3;

/** Level dimensi Pengalaman: 1 = L1 (Pemula), 2 = L2 (Menengah), 3 = L3 (Ahli) */
const levelPengalaman = (score: number): 1 | 2 | 3 =>
  Math.min(3, Math.max(1, score)) as 1 | 2 | 3;

const LEVEL_TO_PROFILE: Record<1 | 2 | 3, RiskProfile> = {
  1: "Konservatif",
  2: "Moderat",
  3: "Agresif",
};

interface DimensionResult {
  levelPsikologis: 1 | 2 | 3;
  levelFinansial: 1 | 2 | 3;
  levelPengalaman: 1 | 2 | 3;
  riskProfile: RiskProfile;
}

/**
 * Menentukan profil risiko akhir dengan 3 aturan emas:
 * 1. Hukum Rantai Terlemah  : profil mengikuti level TERENDAH antara
 *    Psikologis dan Finansial.
 * 2. Hukum Pengalaman (Safety Cap): jika Pemula (L1), profil maksimal
 *    yang diizinkan hanyalah Moderat.
 * 3. Syarat Agresif         : Agresif HANYA jika Psikologis >= 3,
 *    Finansial >= 3, dan Pengalaman >= 2 (otomatis terpenuhi oleh
 *    dua aturan di atas).
 */
export function determineRiskProfile(
  payload: Record<string, { value: string; score?: number }>,
): DimensionResult {
  // Total skor per dimensi
  const totalPsikologis = PSIKOLOGIS_IDS.reduce(
    (sum, id) => sum + (payload[id]?.score ?? 0),
    0,
  );
  const totalFinansial = FINANSIAL_IDS.reduce(
    (sum, id) => sum + (payload[id]?.score ?? 0),
    0,
  );
  const skorPengalaman = payload[EXPERIENCE_ID]?.score ?? 0;

  const lvlPsikologis = levelPsikologis(totalPsikologis);
  const lvlFinansial = levelFinansial(totalFinansial);
  const lvlPengalaman = levelPengalaman(skorPengalaman);

  // 1. Hukum Rantai Terlemah (Bottleneck)
  let finalLevel: 1 | 2 | 3 = Math.min(lvlPsikologis, lvlFinansial) as
    | 1
    | 2
    | 3;

  // 2. Hukum Pengalaman (Safety Cap): Pemula maksimal Moderat
  if (lvlPengalaman === 1 && finalLevel > 2) {
    finalLevel = 2;
  }

  // 3. Syarat Agresif: Psikologis >= 3, Finansial >= 3, Pengalaman >= 2
  const agresifAllowed =
    lvlPsikologis >= 3 && lvlFinansial >= 3 && lvlPengalaman >= 2;
  if (finalLevel === 3 && !agresifAllowed) {
    finalLevel = 2;
  }

  return {
    levelPsikologis: lvlPsikologis,
    levelFinansial: lvlFinansial,
    levelPengalaman: lvlPengalaman,
    riskProfile: LEVEL_TO_PROFILE[finalLevel],
  };
}

export default function NewRecommendation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    capital: "", // inisialisasi default agar selalu ada untuk type safety
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = questionnaireJson.length;
  const currentQuestion = questionnaireJson[step];

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Membentuk data lengkap (termasuk score) untuk dikirim ke Backend/GA
    const finalPayload: Record<string, { value: string; score?: number }> = {};

    questionnaireJson.forEach((q) => {
      const answerValue = answers[q.id];
      if (q.type === "radio" && q.options) {
        const selectedOption = q.options.find((o) => o.value === answerValue);
        finalPayload[q.id] = {
          value: answerValue,
          score: selectedOption?.score,
        };
      } else {
        finalPayload[q.id] = { value: answerValue };
      }
    });

    // Menentukan profil risiko akhir berdasarkan matriks skoring
    const dimensi = determineRiskProfile(finalPayload);

    // Profil risiko ikut dikirim ke Backend/GA
    finalPayload.risk_profile = { value: dimensi.riskProfile ?? "" };

    // Anda bisa melihat hasil payload lengkapnya di console browser
    console.log(
      "Data yang akan dikirim ke Backend Algoritma Genetika:",
      finalPayload,
    );
    console.log("Rincian Perhitungan Profil Risiko:", {
      "Level Psikologis (Q1-Q2)": dimensi.levelPsikologis,
      "Level Finansial (Q3-Q6)": dimensi.levelFinansial,
      "Level Pengalaman (Q7)": dimensi.levelPengalaman,
      "Profil Akhir": dimensi.riskProfile,
    });

    try {
      const formData: FormData = {
        capital: answers.capital,
        dropReaction: answers.dropReaction,
        mainPriority: answers.mainPriority,
        timeHorizon: answers.timeHorizon,
        emergencyFund: answers.emergencyFund,
        wealthProportion: answers.wealthProportion,
        withdrawalLikelihood: answers.withdrawalLikelihood,
        experience: answers.experience,
      };

      const apiPayload = {
        budget: Number(answers.capital),
        risk_profile: dimensi.riskProfile,
        answers: finalPayload,
      };

      const response =
        await portofolioService.stockPortofolioGenerate(apiPayload);

      console.log(response);

      // navigate("/portfolio", {
      //   state: { formData, riskProfile: dimensi.riskProfile },
      // });
    } catch (error) {
      console.error("Error filtering stocks:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentStepValid = () => {
    const val = answers[currentQuestion.id];
    return val !== undefined && val.trim() !== "";
  };

  return (
    <div className="min-h-full bg-card rounded-2xl shadow-card border border-border p-4 md:p-8 lg:p-12">
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
                        className={`text-xl h-14 bg-card ${currentQuestion.prefix ? "pl-12" : "pl-4"}`}
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
                            className="flex items-center space-x-3 bg-card border border-border p-5 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
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
