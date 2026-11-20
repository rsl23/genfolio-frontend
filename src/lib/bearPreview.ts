/** Refresh changed advice without automatically retrying a portfolio order. */
export function isBearPreviewChanged(error: unknown): boolean {
  const err = error as {
    response?: { data?: { detail?: unknown; message?: unknown } };
    message?: unknown;
  } | null;
  return [err?.response?.data?.detail, err?.response?.data?.message, err?.message]
    .some((value) => typeof value === "string" &&
      /Indikator pasar berubah sejak pratinjau|Pratinjau bear market sudah berubah/i.test(value));
}

export const BEAR_PREVIEW_UPDATED =
  "Pratinjau pasar sudah diperbarui. Periksa saran terbaru, lalu konfirmasikan kembali.";
