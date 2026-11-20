export type AnalysisStage = "preparing" | "market" | "analyzing" | "optimizing" | "allocating" | "narrative" | "saving" | "skipped";

export interface PortfolioProgress {
  stage: AnalysisStage;
  title: string;
  detail: string;
  generation?: number;
  total_generations?: number;
  fitness?: number | null;
  candidates?: number;
  series_index?: number;
  series_total?: number;
  series_date?: string;
  engine_elapsed_seconds?: number;
  generations_per_second?: number | null;
}

/** Older backends ignore Accept and return their normal JSON response. Read
 * that same response without retrying a portfolio creation or rebalance. */
export async function readPortfolioResponse<T>(
  stream: ReadableStream<Uint8Array>, contentType: string,
  onProgress: (progress: PortfolioProgress) => void,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  if (contentType.includes("text/event-stream")) return readPortfolioStream<T>(stream, onProgress, signal);
  if (contentType.includes("application/json")) return new Response(stream).json() as Promise<T>;
  await stream.cancel();
  throw new Error("Format hasil analisis belum dapat dibaca. Periksa portofolio Anda sebelum mencoba kembali.");
}

/** Read SSE frames across arbitrary byte boundaries, including UTF-8 text. */
export async function readPortfolioStream<T>(
  stream: ReadableStream<Uint8Array>,
  onProgress: (progress: PortfolioProgress) => void,
  signal?: AbortSignal,
): Promise<T> {
  const reader = stream.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    signal?.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalize complete CRLF pairs while preserving a split trailing CR.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split("\n");
        const kind = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const raw = lines.filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (!raw) continue;
        const payload = JSON.parse(raw);
        if (kind === "progress") onProgress(payload as PortfolioProgress);
        if (kind === "result") return payload as T;
        if (kind === "error") {
          // Preserve the existing error shape (including stale bear previews).
          throw Object.assign(new Error(payload.detail || "Analisis belum berhasil diselesaikan."), {
            response: { status: payload.status, data: { detail: payload.detail } },
          });
        }
      }
      if (done) break;
    }
    throw new Error("Koneksi terputus sebelum hasil diterima. Periksa portofolio Anda sebelum mencoba kembali.");
  } finally {
    signal?.removeEventListener("abort", abort);
    try { await reader.cancel(); } catch { /* The connection may already be closed. */ }
    reader.releaseLock();
  }
}
