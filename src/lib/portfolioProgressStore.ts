import type { PortfolioProgress } from "./portfolioProgress.ts";

export interface AnalysisProgressState {
  current: PortfolioProgress;
  startedAt: number;
  updatedAt: number;
  scores: { generation: number; fitness: number }[];
  activities: { title: string; at: number }[];
}

function initialState(preview = false): AnalysisProgressState {
  const now = Date.now();
  return { startedAt: now, updatedAt: now, scores: [], activities: [], current: preview ? {
    stage: "market", title: "Memeriksa kondisi pasar",
    detail: "Membaca pergerakan pasar untuk menyiapkan pilihan alokasi modal Anda.",
  } : {
    stage: "preparing", title: "Menyiapkan analisis Anda",
    detail: "Mencocokkan pengaturan dan menyiapkan data yang diperlukan.",
  } };
}

/** The panel alone subscribes. Coalesce same-phase updates to one per second;
 * deliver phase changes immediately, and suspend updates in hidden tabs. */
export function createPortfolioProgressStore(intervalMs = 1000) {
  let snapshot = initialState();
  const listeners = new Set<() => void>();
  let pending: { progress: PortfolioProgress; at: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastPublishedAt = -Infinity;
  let visible = true;
  let active = true;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function apply(progress: PortfolioProgress, at: number) {
    const newPeriod = progress.series_index !== snapshot.current.series_index;
    let scores = newPeriod ? [] : snapshot.scores;
    if (progress.stage === "optimizing" && progress.generation != null &&
        progress.fitness != null && Number.isFinite(progress.fitness) &&
        scores.at(-1)?.generation !== progress.generation) {
      scores = [...scores, { generation: progress.generation, fitness: progress.fitness }].slice(-100);
    }
    const activities = progress.title === snapshot.current.title ? snapshot.activities :
      [...snapshot.activities, { title: snapshot.current.title, at: snapshot.updatedAt }].slice(-3);
    snapshot = { ...snapshot, updatedAt: at, scores, activities,
      current: { ...(newPeriod ? {} : snapshot.current), ...progress } };
    lastPublishedAt = Date.now();
    for (const listener of [...listeners]) listener();
  }
  function flush() {
    clearTimer();
    if (!active || !visible || pending === null) return;
    const update = pending;
    pending = null;
    apply(update.progress, update.at);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start(preview = false) {
      clearTimer();
      pending = null;
      active = true;
      snapshot = initialState(preview);
      lastPublishedAt = -Infinity;
      for (const listener of [...listeners]) listener();
    },
    receive(progress: PortfolioProgress) {
      if (!active) return;
      const previous = pending?.progress ?? snapshot.current;
      const phaseChanged = progress.stage !== previous.stage || progress.title !== previous.title ||
        progress.series_index !== previous.series_index;
      if (phaseChanged && visible) flush();
      pending = { progress, at: Date.now() };
      if (!visible) return;
      if (phaseChanged || Date.now() - lastPublishedAt >= intervalMs) flush();
      else if (timer === null) timer = setTimeout(flush, intervalMs - (Date.now() - lastPublishedAt));
    },
    flush,
    setVisible(value: boolean) {
      visible = value;
      if (visible) flush();
      else clearTimer();
    },
    activate() { active = true; },
    dispose() { active = false; clearTimer(); pending = null; },
  };
}

export type PortfolioProgressStore = ReturnType<typeof createPortfolioProgressStore>;
