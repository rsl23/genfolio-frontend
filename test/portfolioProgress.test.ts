import assert from "node:assert/strict";
import test from "node:test";
import { readPortfolioResponse, readPortfolioStream, type PortfolioProgress } from "../src/lib/portfolioProgress.ts";

function bytes(text: string, chunkSize = 1) {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < encoded.length; i += chunkSize) controller.enqueue(encoded.slice(i, i + chunkSize));
    controller.close();
  } });
}

test("an older running backend's JSON result is accepted without another request or invented progress", async () => {
  const progress: PortfolioProgress[] = [];
  const stream = bytes('{"status":"success","data":{"id":"saved-once"}}');
  const result = await readPortfolioResponse<{data: {id: string}}>(stream,
    "application/json; charset=utf-8", (event) => progress.push(event));
  assert.equal(result.data.id, "saved-once");
  assert.equal(progress.length, 0);
});

test("an updated backend's negotiated SSE response still delivers real progress", async () => {
  const progress: PortfolioProgress[] = [];
  const result = await readPortfolioResponse<{status: string}>(bytes('event: progress\ndata: {"stage":"optimizing","generation":2}\n\nevent: result\ndata: {"status":"success"}\n\n'),
    "text/event-stream; charset=utf-8", (event) => progress.push(event));
  assert.equal(result.status, "success");
  assert.equal(progress[0].generation, 2);
});

test("an unexpected response is rejected without retrying generation", async () => {
  await assert.rejects(readPortfolioResponse(bytes("<html>Not Found</html>"), "text/html", () => {}), /Periksa portofolio Anda/);
});

test("SSE preserves fragmented Unicode, CRLF, heartbeats, progress, and final result", async () => {
  const progress: PortfolioProgress[] = [];
  const text = ': keep-alive\r\n\r\nevent: progress\r\ndata: {"stage":"optimizing","title":"Mengolah — saham Anda","generation":1,"fitness":1.25}\r\n\r\nevent: result\r\ndata: {"status":"success","data":{"id":"saved"}}\r\n\r\n';
  const result = await readPortfolioStream<{status: string; data: {id: string}}>(bytes(text), (event) => progress.push(event));
  assert.equal(progress.length, 1);
  assert.equal(progress[0].title, "Mengolah — saham Anda");
  assert.equal(progress[0].generation, 1);
  assert.equal(result.data.id, "saved");
});

test("server domain errors retain the shape expected by existing error handling", async () => {
  await assert.rejects(readPortfolioStream(bytes('event: error\ndata: {"status":400,"detail":"Pratinjau bear market sudah berubah"}\n\n'), () => {}),
    (error: unknown) => {
      const e = error as Error & {response: {status: number; data: {detail: string}}};
      assert.equal(e.response.status, 400);
      assert.match(e.response.data.detail, /sudah berubah/);
      return true;
    });
});

test("a truncated stream does not turn into a successful or retried mutation", async () => {
  await assert.rejects(readPortfolioStream(bytes('event: progress\ndata: {"stage":"saving"}\n\n'), () => {}), /Periksa portofolio Anda/);
});

test("terminal result cancels and releases the reader", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({start(controller) {
    controller.enqueue(new TextEncoder().encode('event: result\ndata: {"status":"success"}\n\n'));
  }, cancel() { cancelled = true; } });
  await readPortfolioStream(stream, () => {});
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});
test("stopping analysis cancels an idle SSE reader and releases its connection", async () => {
  const controller = new AbortController();
  let cancelled = 0;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled++; } });
  const result = readPortfolioStream(stream, () => undefined, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(cancelled, 1);
  assert.equal(stream.locked, false);
});
