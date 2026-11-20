import assert from "node:assert/strict";
import test from "node:test";
import { portfolioManagementTarget } from "../src/lib/portfolioManagement.ts";
import type { PortfolioData } from "../src/types/index.ts";

const snapshot = (id: string, status: string, parent: string | null = null) => ({
  id, status_portofolio: status, parent_portofolio_id: parent,
} as PortfolioData);

test("membuka portofolio awal tetap mengelola posisi rebalance terakhir", () => {
  const root=snapshot("root","replaced"); const latest=snapshot("latest","active","root");
  assert.equal(portfolioManagementTarget(root,{root,latest,snapshots:[root,latest]},"live"),latest);
});
test("portofolio pilihan tetap bisa dikelola meskipun seri lain menjadi aktif global", () => {
  const root=snapshot("root","replaced"); const latest=snapshot("latest","replaced","root");
  assert.equal(portfolioManagementTarget(root,{root,latest,snapshots:[root,latest]},"live"),latest);
});
test("panel backtest tetap tersedia saat melihat periode awal", () => {
  const root=snapshot("root","replaced_backtest"); const latest=snapshot("latest","active_backtest","root");
  assert.equal(portfolioManagementTarget(root,{root,latest,snapshots:[root,latest]},"backtest"),latest);
});
test("riwayat belum lengkap tidak mengarahkan aksi ke snapshot lama atau seri lain", () => {
  const selected=snapshot("selected","replaced"); const other=snapshot("other","active");
  assert.equal(portfolioManagementTarget(selected,null,"live"),null);
  assert.equal(portfolioManagementTarget(selected,{root:other,latest:other,snapshots:[other]},"live"),null);
  assert.equal(portfolioManagementTarget(other,null,"live"),other);
  assert.equal(portfolioManagementTarget(other,null,"backtest"),null);
});
