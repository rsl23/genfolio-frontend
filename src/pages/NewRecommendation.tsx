import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import { ArrowRight, Activity, AlertCircle, ArrowLeft, Info } from "lucide-react";
import type {
  GeneratePortofolioRequest,
  PortfolioMode,
  RiskProfile,
} from "@/types";
import questionsData from "@/data/questions.json";
import { portofolioService } from "@/services/portofolioService";
import {
  BACKTEST_PICKER_MAX,
  BACKTEST_PICKER_MIN,
  clampToBacktestPickerRange,
  defaultBacktestDateRef,
  getBacktestDateRef,
  getPortfolioMode,
  setBacktestDateRef,
  setCachedPortfolio,
  setPortfolioMode,
} from "@/lib/portfolioMode";

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

/**
 * Ubah error dari axios/FastAPI menjadi pesan yang bisa ditampilkan ke user.
 * FastAPI mengirim detail error pada `response.data.detail` (string) atau
 * pada `message` untuk envelope ApiResponse.
 */
function describeApiError(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown; message?: string } };
    message?: string;
  };
  const data = err?.response?.data;
  if (typeof data?.detail === "string" && data.detail.trim() !== "") {
    return data.detail;
  }
  if (Array.isArray(data?.detail)) {
    return `Validasi gagal: ${JSON.stringify(data.detail)}`;
  }
  if (typeof data?.message === "string" && data.message.trim() !== "") {
    return data.message;
  }
  if (err?.response?.status) {
    return `Server membalas status ${err.response.status} tanpa detail.`;
  }
  return err?.message ?? "Terjadi kesalahan yang tidak diketahui.";
}

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
  const location = useLocation();
  // Mode bisa sudah dipilih dari halaman Portofolio Saya (navigasi + state)
  const navigationState = location.state as { mode?: PortfolioMode } | null;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    capital: "", // inisialisasi default agar selalu ada untuk type safety
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Profil risiko pilihan user jika override hasil kuis (null = pakai hasil kuis)
  const [overrideProfile, setOverrideProfile] = useState<RiskProfile>(null);
  // ===== Mode program: "live" (data pasar terbaru) / "backtest" (historis) =====
  const [mode, setMode] = useState<PortfolioMode>(
    () => navigationState?.mode ?? getPortfolioMode(),
  );
  // Tanggal acuan simulasi (date_ref) — hanya dipakai saat mode backtest
  const [backtestDate, setBacktestDate] = useState<string>(() =>
    clampToBacktestPickerRange(
      getBacktestDateRef() ?? defaultBacktestDateRef(),
    ),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isBacktest = mode === "backtest";
  // date_ref wajib dan harus berada dalam rentang tanggal yang boleh dipilih
  // user (BACKTEST_PICKER_MIN..BACKTEST_PICKER_MAX) supaya GA tidak gagal
  // dengan error 400 dari server.
  const isBacktestDateValid =
    !isBacktest ||
    (backtestDate !== "" &&
      backtestDate >= BACKTEST_PICKER_MIN &&
      backtestDate <= BACKTEST_PICKER_MAX);

  const handleModeChange = (next: PortfolioMode) => {
    setMode(next);
    setSubmitError(null);
    // Simpan preferensi agar halaman /portfolio (dan kunjungan berikutnya)
    // memakai mode yang sama.
    setPortfolioMode(next);
    if (next === "backtest") {
      // Pastikan tanggal simulasi selalu berada di rentang picker — termasuk
      // saat nilai lama dari localStorage ternyata di luar rentang.
      const safeDate = clampToBacktestPickerRange(
        backtestDate || defaultBacktestDateRef(),
      );
      setBacktestDate(safeDate);
      setBacktestDateRef(safeDate);
    }
  };

  const totalSteps = questionnaireJson.length;
  // Step terakhir tambahan = layar konfirmasi profil risiko
  const isConfirmStep = step === totalSteps;
  const currentQuestion = questionnaireJson[Math.min(step, totalSteps - 1)];

  /** Membentuk payload jawaban (dengan skor) dari state `answers` */
  const buildPayload = () => {
    const payload: Record<string, { value: string; score?: number }> = {};
    questionnaireJson.forEach((q) => {
      const answerValue = answers[q.id];
      if (q.type === "radio" && q.options) {
        const selectedOption = q.options.find((o) => o.value === answerValue);
        payload[q.id] = {
          value: answerValue,
          score: selectedOption?.score,
        };
      } else {
        payload[q.id] = { value: answerValue };
      }
    });
    return payload;
  };

  // Profil risiko hasil kuis dihitung live dari jawaban user
  const quizResult = determineRiskProfile(buildPayload());
  // Profil final: pilihan user (jika override) atau hasil kuis
  const finalProfile: RiskProfile = overrideProfile ?? quizResult.riskProfile;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1); // masuk/berpindah ke layar konfirmasi
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Membentuk data lengkap (termasuk score) untuk dikirim ke Backend/GA
    const finalPayload = buildPayload();

    // Profil risiko final (hasil kuis atau pilihan user) ikut dikirim ke Backend/GA
    finalPayload.risk_profile = { value: finalProfile ?? "" };

    // Anda bisa melihat hasil payload lengkapnya di console browser
    console.log(
      "Data yang akan dikirim ke Backend Algoritma Genetika:",
      finalPayload,
    );
    console.log("Rincian Perhitungan Profil Risiko:", {
      "Level Psikologis (Q1-Q2)": quizResult.levelPsikologis,
      "Level Finansial (Q3-Q6)": quizResult.levelFinansial,
      "Level Pengalaman (Q7)": quizResult.levelPengalaman,
      "Profil Hasil Kuis": quizResult.riskProfile,
      "Profil Final (dikirim)": finalProfile,
      "Di-override User": overrideProfile !== null,
    });

    try {
      // Body mengikuti PortfolioGenerateRequest backend: mode backtest wajib
      // menyertakan date_ref; mode live tidak mengirim date_ref sama sekali.
      const apiPayload: GeneratePortofolioRequest = {
        budget: Number(answers.capital),
        risk_profile: finalProfile,
        answers: finalPayload,
        backtest: isBacktest,
        ...(isBacktest ? { date_ref: backtestDate } : {}),
      };
      console.log(
        `Payload ke GA (mode ${mode}):`,
        apiPayload,
      );

      const response =
        await portofolioService.stockPortofolioGenerate(apiPayload);

      console.log(response);

      // Simpan preferensi mode + cache hasil generate. Cache dipakai halaman
      // /portfolio untuk menampilkan portofolio yang baru dibuat (khusus
      // backtest, karena GET /my-portofolio mengembalikan portofolio live).
      setPortfolioMode(mode);
      setBacktestDateRef(isBacktest ? backtestDate : null);
      if (response.status === "success" && response.data) {
        setCachedPortfolio(mode, response.data);
      }

      // Halaman /portfolio otomatis mengambil portofolio terbaru
      // via GET /api/v1/portfolios/my-portofolio saat dirender (mode live),
      // dan memakai state/cache di atas saat mode backtest.
      // date_ref resmi = field backend; fallback tanggal yang dipilih user.
      const backendDateRef =
        response.status === "success" && response.data?.date_ref
          ? response.data.date_ref.slice(0, 10)
          : null;
      navigate("/portfolio", {
        state: {
          formData: { capital: answers.capital },
          riskProfile: finalProfile,
          mode,
          dateRef: backendDateRef ?? (isBacktest ? backtestDate : null),
          portfolio: response.status === "success" ? response.data : null,
        },
      });
    } catch (error) {
      console.error("Error filtering stocks:", error);
      setSubmitError(describeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentStepValid = () => {
    if (isConfirmStep) return true; // layar konfirmasi selalu valid
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
          {!isConfirmStep && (
            <p className="mt-4 text-xs text-slate-500">
              Pilihan mode program (Live atau Backtest) muncul di langkah
              terakhir, bersamaan dengan hasil profil risiko Anda.
            </p>
          )}
        </div>

        {isConfirmStep && isBacktest && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Mode Backtest:</strong> GA dijalankan memakai data
              historis per {backtestDate}. Hasilnya disimpan sebagai portofolio
              simulasi (status <code>active_backtest</code>) sehingga{" "}
              <strong>portofolio live Anda tidak berubah</strong>.
            </p>
          </div>
        )}

        {/* Content Box */}
        <div className="bg-slate-50 border rounded-2xl p-6 md:p-10 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div className="flex-1">
            {isConfirmStep ? (
              /* ================= LAYAR KONFIRMASI PROFIL RISIKO ================= */
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-3">
                    Profil Risiko Anda
                  </h2>
                  <p className="text-slate-500 text-lg">
                    Berdasarkan jawaban kuesioner Anda, sistem menentukan profil
                    risiko berikut. Silakan konfirmasi, atau ubah ke pilihan
                    lain jika Anda merasa tidak cocok.
                  </p>
                </div>

                {/* Badge profil hasil kuis */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                  <p className="text-sm font-medium text-blue-600 mb-1">
                    Hasil Analisis Kuesioner
                  </p>
                  <p className="text-4xl font-bold text-blue-900">
                    {quizResult.riskProfile}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs text-slate-600">
                    <span className="bg-white px-3 py-1 rounded-full border border-slate-200">
                      Psikologis: Level {quizResult.levelPsikologis}
                    </span>
                    <span className="bg-white px-3 py-1 rounded-full border border-slate-200">
                      Finansial: Level {quizResult.levelFinansial}
                    </span>
                    <span className="bg-white px-3 py-1 rounded-full border border-slate-200">
                      Pengalaman: Level {quizResult.levelPengalaman}
                    </span>
                  </div>
                  {overrideProfile &&
                    overrideProfile !== quizResult.riskProfile && (
                      <p className="text-xs text-amber-600 mt-4">
                        Anda memilih profil sendiri (
                        <strong>{overrideProfile}</strong> sebagai ganti hasil
                        kuesioner <strong>{quizResult.riskProfile}</strong>).
                      </p>
                    )}
                </div>

                {/* ===== Pilih Mode Program: Live / Backtest ===== */}
                <div className="bg-card border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Pilih Mode Program
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <strong>Live</strong> memakai data pasar terbaru,{" "}
                      <strong>Backtest</strong> menyimulasikan strategi pada
                      tanggal historis. Kuesioner dan profil risiko di atas
                      berlaku untuk kedua mode.
                    </p>
                  </div>
                  <div className="md:ml-auto flex flex-wrap items-end gap-4">
                    <PortfolioModeToggle
                      mode={mode}
                      onChange={handleModeChange}
                      disabled={isSubmitting}
                    />
                    {isBacktest && (
                      <div className="space-y-1">
                        <Label
                          htmlFor="date-ref"
                          className="text-xs font-medium text-slate-600"
                        >
                          Tanggal Simulasi (date_ref)
                        </Label>
                        <Input
                          id="date-ref"
                          type="date"
                          value={backtestDate}
                          min={BACKTEST_PICKER_MIN}
                          max={BACKTEST_PICKER_MAX}
                          disabled={isSubmitting}
                          aria-invalid={!isBacktestDateValid}
                          onChange={(e) => {
                            setBacktestDate(e.target.value);
                            setBacktestDateRef(e.target.value || null);
                          }}
                          className="h-9 w-44 bg-card"
                        />
                        <p
                          className={`text-[11px] ${
                            isBacktestDateValid
                              ? "text-slate-500"
                              : "text-red-600"
                          }`}
                        >
                          {isBacktestDateValid
                            ? `Tanggal simulasi yang tersedia ${BACKTEST_PICKER_MIN} s/d ${BACKTEST_PICKER_MAX}.`
                            : `Pilih tanggal antara ${BACKTEST_PICKER_MIN} dan ${BACKTEST_PICKER_MAX}.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ringkasan mode eksekusi */}
                <div
                  className={`rounded-2xl p-5 border text-sm ${
                    isBacktest
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <p className="font-medium mb-1">
                    Mode: {isBacktest ? "Simulasi Backtest" : "Live"}
                  </p>
                  <p className="leading-relaxed">
                    {isBacktest
                      ? `GA akan dijalankan memakai data historis per ${backtestDate}. Hasilnya tersimpan sebagai portofolio simulasi terpisah dan tidak mengubah portofolio live Anda.`
                      : "GA akan dijalankan memakai data pasar terbaru untuk memperbarui portofolio live Anda."}
                  </p>
                </div>

                {/* Pilihan override */}
                <div>
                  <Label className="text-base mb-3 block">
                    Gunakan profil ini untuk rekomendasi:
                  </Label>
                  <RadioGroup
                    value={overrideProfile ?? quizResult.riskProfile ?? ""}
                    onValueChange={(val) =>
                      setOverrideProfile(val as RiskProfile)
                    }
                    className="space-y-3 max-w-xl"
                  >
                    {(
                      ["Konservatif", "Moderat", "Agresif"] as RiskProfile[]
                    ).map((profile) => {
                      const isQuizResult = profile === quizResult.riskProfile;
                      const radioId = `confirm-profile-${profile}`;
                      return (
                        <div
                          key={profile}
                          className={`flex items-center space-x-3 bg-card border p-5 rounded-xl cursor-pointer transition-colors ${
                            (overrideProfile ?? quizResult.riskProfile) ===
                            profile
                              ? "border-blue-500 bg-blue-50/50"
                              : "border-border hover:border-blue-400 hover:bg-blue-50/50"
                          }`}
                        >
                          <RadioGroupItem
                            value={profile}
                            id={radioId}
                            className="w-5 h-5"
                          />
                          <Label
                            htmlFor={radioId}
                            className="cursor-pointer w-full text-base font-medium"
                          >
                            {profile}
                            {isQuizResult && (
                              <span className="ml-2 text-xs font-normal text-blue-600">
                                (rekomendasi sistem dari kuesioner Anda)
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              </div>
            ) : (
              /* ================= PERTANYAAN KUESIONER ================= */
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
            )}
          </div>

          {/* Pesan kegagalan dari backend (mis. date_ref di luar cakupan data) */}
          {submitError && (
            <div className="mt-8 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">
                  Gagal menjalankan rekomendasi
                </p>
                <p className="text-sm mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

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
                !isCurrentStepValid() || isSubmitting || !isBacktestDateValid
              }
              className="w-full sm:w-auto h-12 px-8 text-base bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-spin" /> Menjalankan
                  Algoritma Genetika...
                </span>
              ) : isConfirmStep ? (
                <span className="flex items-center gap-2">
                  {isBacktest
                    ? "Setuju & Jalankan Simulasi"
                    : "Setuju & Jalankan Analisis"}{" "}
                  <ArrowRight className="w-5 h-5" />
                </span>
              ) : step === totalSteps - 1 ? (
                <span className="flex items-center gap-2">
                  Lihat Profil Risiko <ArrowRight className="w-5 h-5" />
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
