import { useCallback, useEffect, useRef, useState } from "react";
import { createPortfolioProgressStore } from "@/lib/portfolioProgressStore";

export function usePortfolioProgress() {
  const [store] = useState(createPortfolioProgressStore);
  const controller = useRef<AbortController | null>(null);
  const start = useCallback((preview = false) => {
    controller.current?.abort();
    controller.current = new AbortController();
    store.start(preview);
    return controller.current.signal;
  }, [store]);
  const cancel = useCallback(() => {
    store.dispose();
    controller.current?.abort();
  }, [store]);
  useEffect(() => {
    store.activate();
    const updateVisibility = () => store.setVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      store.dispose();
      controller.current?.abort();
    };
  }, [store]);
  return { store, start, cancel, onProgress: store.receive };
}
