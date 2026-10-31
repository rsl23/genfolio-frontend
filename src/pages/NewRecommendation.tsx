import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { parseRupiahInput } from "@/lib/rupiahInput";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PortfolioModeToggle from "@/components/PortfolioModeToggle";
import BearMarketDialog from "@/components/BearMarketDialog";
import { ArrowRight, Activity, AlertCircle, ArrowLeft } from "lucide-react";
import type {
  GeneratePortofolioRequest,
  PortfolioMode,
  RiskProfile,
  BearChoice,
  BearMarketAssessment,
  BearPolicy,
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
    response?: {
      status?: number;
      data?: { detail?: unknown; message?: string };
    };
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
function determineRiskProfile(
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
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [bearPreview, setBearPreview] = useState<BearMarketAssessment | null>(null);
  const [bearPolicy, setBearPolicy] = useState<BearPolicy>("manual");
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
      await openBearDialog();
    }
  };

  const openBearDialog = async () => {
    setIsPreviewing(true);
    setSubmitError(null);
    try {
      const [policy, preview] = await Promise.all([
        portofolioService.getBearPolicy(),
        portofolioService.previewBearMarket({
          risk_profile: finalProfile ?? "Moderat",
          backtest: isBacktest,
          ...(isBacktest ? { date_ref: backtestDate } : {}),
        }),
      ]);
      setBearPolicy(policy);
      setBearPreview(preview);
    } catch (error) {
      setSubmitError(describeApiError(error));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (
    policy: BearPolicy, choices: Record<string, BearChoice>,
  ) => {
    if (!bearPreview) return;
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
      if (policy !== bearPolicy) await portofolioService.setBearPolicy(policy);
      // Body mengikuti PortfolioGenerateRequest backend: mode backtest wajib
      // menyertakan date_ref; mode live tidak mengirim date_ref sama sekali.
      const apiPayload: GeneratePortofolioRequest = {
        budget: parseRupiahInput(answers.capital),
        name_portofolio: portfolioName.trim(),
        description: portfolioDescription.trim() || null,
        risk_profile: finalProfile,
        answers: finalPayload,
        backtest: isBacktest,
        bear_management: true,
        bear_choice: choices[bearPreview.requested_date],
        bear_preview_as_of: bearPreview.as_of,
        bear_preview_fingerprint: bearPreview.fingerprint,
        ...(isBacktest ? { date_ref: backtestDate } : {}),
      };
      console.log(`Payload ke GA (mode ${mode}):`, apiPayload);

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
          formData: { capital: String(parseRupiahInput(answers.capital)) },
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
    if (isConfirmStep)
      return (
        portfolioName.trim().length > 0 &&
        portfolioName.trim().length <= 80 &&
        portfolioDescription.length <= 500
      );
    const val = answers[currentQuestion.id];
    if (currentQuestion.type === "number") {
      return (
        Number.isFinite(parseRupiahInput(val || "")) &&
        parseRupiahInput(val || "") > 0
      );
    }
    return val !== undefined && val.trim() !== "";
  };

  return (
    <div className="mx-auto max-w-3xl pb-10 animate-in fade-in duration-500">
      <div className="space-y-6">
        <header>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Rekomendasi
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Rekomendasi Baru
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Jawab beberapa pertanyaan untuk menyesuaikan portofolio dengan
            kebutuhan Anda.
          </p>
        </header>

        <div
          aria-label={`Langkah ${step + 1} dari ${totalSteps + 1}`}
          className="rounded-2xl border border-slate-200 bg-card px-5 py-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-800">
              {isConfirmStep ? "Konfirmasi" : currentQuestion.stepLabel}
            </span>
            <span className="tabular-nums text-slate-500">
              {step + 1} / {totalSteps + 1}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${((step + 1) / (totalSteps + 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Content Box */}
        <div className="flex min-h-[400px] flex-col justify-between rounded-2xl border border-slate-200 bg-card p-5 shadow-sm md:p-8">
          <div className="flex-1">
            {isConfirmStep ? (
              /* ================= LAYAR KONFIRMASI PROFIL RISIKO ================= */
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Konfirmasi rekomendasi
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tinjau profil risiko dan pilih mode sebelum melanjutkan.
                  </p>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="portfolio-name">
                      Nama portofolio <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="portfolio-name"
                      value={portfolioName}
                      maxLength={80}
                      onChange={(event) => setPortfolioName(event.target.value)}
                      placeholder="Contoh: Portofolio Agresif"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-slate-500">
                      Nama ini muncul di riwayat dan tetap dipakai saat
                      rebalance.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portfolio-description">
                      Deskripsi{" "}
                      <span className="font-normal text-slate-500">
                        (opsional)
                      </span>
                    </Label>
                    <textarea
                      id="portfolio-description"
                      value={portfolioDescription}
                      maxLength={500}
                      rows={2}
                      onChange={(event) =>
                        setPortfolioDescription(event.target.value)
                      }
                      disabled={isSubmitting}
                      placeholder="Tujuan atau catatan singkat tentang portofolio ini"
                      className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-50"
                    />
                    <p className="text-right text-xs text-slate-400">
                      {portfolioDescription.length}/500
                    </p>
                  </div>
                </div>

                {/* Badge profil hasil kuis */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <p className="text-xs font-medium text-slate-600">
                    Profil berdasarkan jawaban Anda
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-primary">
                    {quizResult.riskProfile}
                  </p>
                  {overrideProfile &&
                    overrideProfile !== quizResult.riskProfile && (
                      <p className="mt-2 text-xs text-slate-600">
                        Pilihan Anda: <strong>{overrideProfile}</strong>
                      </p>
                    )}
                  <details className="mt-3 text-xs text-slate-500">
                    <summary className="cursor-pointer">
                      Lihat dasar penilaian
                    </summary>
                    <p className="mt-2">
                      Psikologis level {quizResult.levelPsikologis} · Finansial
                      level {quizResult.levelFinansial} · Pengalaman level{" "}
                      {quizResult.levelPengalaman}
                    </p>
                  </details>
                </div>

                {/* ===== Pilih Mode Program: Live / Backtest ===== */}
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Mode rekomendasi
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Live memakai harga terkini; Backtest memakai data
                      historis.
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
                          Tanggal simulasi
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
                        {!isBacktestDateValid && (
                          <p className="text-xs text-red-600">
                            Pilih tanggal antara {BACKTEST_PICKER_MIN} dan{" "}
                            {BACKTEST_PICKER_MAX}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  {isBacktest
                    ? "Hasil simulasi disimpan terpisah; portofolio live tidak berubah."
                    : "Rekomendasi live baru akan menggantikan portofolio live aktif."}
                </p>

                {/* Pilihan override */}
                <div>
                  <Label className="mb-3 block text-sm font-medium">
                    Profil yang digunakan
                  </Label>
                  <RadioGroup
                    value={overrideProfile ?? quizResult.riskProfile ?? ""}
                    onValueChange={(val) =>
                      setOverrideProfile(val as RiskProfile)
                    }
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {(
                      ["Konservatif", "Moderat", "Agresif"] as RiskProfile[]
                    ).map((profile) => {
                      const isQuizResult = profile === quizResult.riskProfile;
                      const radioId = `confirm-profile-${profile}`;
                      return (
                        <div
                          key={profile}
                          className={`flex items-center gap-2 rounded-xl border p-3 transition-colors ${
                            (overrideProfile ?? quizResult.riskProfile) ===
                            profile
                              ? "border-blue-500 bg-blue-50/50"
                              : "border-border hover:border-blue-400 hover:bg-blue-50/50"
                          }`}
                        >
                          <RadioGroupItem
                            value={profile}
                            id={radioId}
                            className="h-4 w-4"
                          />
                          <Label
                            htmlFor={radioId}
                            className="w-full cursor-pointer text-sm font-medium"
                          >
                            {profile}
                            {isQuizResult && (
                              <span className="ml-1 text-[11px] font-normal text-primary">
                                Disarankan
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
                      <Label
                        htmlFor={`answer-${currentQuestion.id}`}
                        className="text-base mb-3 block"
                      >
                        Nominal
                      </Label>
                      <div className="relative">
                        {currentQuestion.prefix && (
                          <span className="absolute left-4 top-3.5 text-slate-500 font-medium">
                            {currentQuestion.prefix}
                          </span>
                        )}
                        <RupiahInput
                          id={`answer-${currentQuestion.id}`}
                          placeholder={currentQuestion.placeholder}
                          className={`text-xl h-14 bg-card ${currentQuestion.prefix ? "pl-12" : "pl-4"}`}
                          value={answers[currentQuestion.id] || ""}
                          onValueChange={(value) => {
                            setAnswers({
                              ...answers,
                              [currentQuestion.id]: value,
                            });
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Titik untuk ribuan, koma untuk desimal. Contoh:
                        50.000.000,50.
                      </p>
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
                        className="max-w-xl space-y-2"
                      >
                        {currentQuestion.options.map((opt, idx) => {
                          const radioId = `${currentQuestion.id}-opt-${idx}`;
                          return (
                            <div
                              key={opt.value}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                            >
                              <RadioGroupItem
                                value={opt.value}
                                id={radioId}
                                className="h-4 w-4"
                              />
                              <Label
                                htmlFor={radioId}
                                className="w-full cursor-pointer text-sm font-medium leading-relaxed"
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
          <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => setStep(step > 0 ? step - 1 : 0)}
              disabled={step === 0 || isSubmitting || isPreviewing}
              className="h-10 w-full gap-2 sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>

            <Button
              onClick={handleNext}
              disabled={
                !isCurrentStepValid() || isSubmitting || isPreviewing || !isBacktestDateValid
              }
              className="h-10 w-full gap-2 px-5 sm:w-auto"
            >
              {isSubmitting || isPreviewing ? (
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 animate-spin" />
                  {isPreviewing ? "Memeriksa kondisi pasar..." : "Menyiapkan rekomendasi..."}
                </span>
              ) : isConfirmStep ? (
                <span className="flex items-center gap-2">
                  {isBacktest ? "Jalankan Simulasi" : "Buat Rekomendasi"}{" "}
                  <ArrowRight className="h-4 w-4" />
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
      {bearPreview && (
        <BearMarketDialog
          assessments={[bearPreview]}
          initialPolicy={bearPolicy}
          capital={parseRupiahInput(answers.capital)}
          busy={isSubmitting}
          error={submitError}
          onClose={() => { setBearPreview(null); setSubmitError(null); }}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
