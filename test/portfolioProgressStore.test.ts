import assert from "node:assert/strict";
import test from "node:test";
import { createPortfolioProgressStore } from "../src/lib/portfolioProgressStore.ts";
import type { PortfolioProgress } from "../src/lib/portfolioProgress.ts";

const generation = (value: number, period?: number): PortfolioProgress => ({
  stage: "optimizing", title: "Mencari komposisi", detail: "Membandingkan saham",
  generation: value, fitness: value / 100, ...(period == null ? {} : {series_index: period}),
});

test("500 rapid generations produce two panel notifications, preserving the latest score", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const store = createPortfolioProgressStore();
  let notifications = 0;
  store.subscribe(() => notifications++);
  for (let index = 1; index <= 500; index++) store.receive(generation(index));
  assert.equal(notifications, 1);
  t.mock.timers.tick(1000);
  assert.equal(notifications, 2);
  assert.equal(store.getSnapshot().current.generation, 500);
  assert.equal(store.getSnapshot().current.fitness, 5);
  store.dispose();
});

test("changes of stage flush the last generation immediately", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const store = createPortfolioProgressStore();
  store.receive(generation(1));
  store.receive(generation(25));
  store.receive({ stage: "narrative", title: "Menyusun penjelasan", detail: "Ringkasan Anda" });
  assert.equal(store.getSnapshot().current.stage, "narrative");
  assert.equal(store.getSnapshot().current.generation, 25);
  assert.equal(store.getSnapshot().scores.at(-1)?.generation, 25);
  store.dispose();
});

test("hidden tabs do not notify subscribers and resume directly at the latest period", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const store = createPortfolioProgressStore();
  let notifications = 0;
  store.subscribe(() => notifications++);
  store.receive(generation(10, 1));
  store.setVisible(false);
  for (let index = 1; index <= 500; index++) store.receive(generation(index, 2));
  t.mock.timers.tick(10000);
  assert.equal(notifications, 1);
  store.setVisible(true);
  assert.equal(notifications, 2);
  assert.equal(store.getSnapshot().current.series_index, 2);
  assert.equal(store.getSnapshot().current.generation, 500);
  assert.deepEqual(store.getSnapshot().scores.map((point) => point.generation), [500]);
  store.dispose();
});

test("disposing an in-flight store prevents timers or late network events from rendering", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  const store = createPortfolioProgressStore();
  store.receive(generation(1));
  store.receive(generation(2));
  store.dispose();
  const snapshot = store.getSnapshot();
  t.mock.timers.tick(1000);
  store.receive(generation(3));
  assert.equal(store.getSnapshot(), snapshot);
  store.activate();
  store.start();
  assert.equal(store.getSnapshot().current.stage, "preparing");
  store.dispose();
});
