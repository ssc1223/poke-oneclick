import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const harnessPath = join(root, 'tests/e2e/fixtures/harness-return-url.js');

// 測試用假單號（非真實訂單）
const CURRENT = 'https://shop.cashier.tw/online/menu/order/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OLD = 'https://shop.cashier.tw/online/menu/order/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PWA = 'https://example.test/poke-oneclick/';

test.beforeAll(async () => {
  mkdirSync(dirname(harnessPath), { recursive: true });
  await build({
    entryPoints: [join(root, 'tests/e2e/harness-return-url.js')],
    bundle: true,
    format: 'iife',
    outfile: harnessPath,
    target: ['es2018'],
    charset: 'utf8',
    legalComments: 'none',
  });
});

test('觸控：從 App 選餐點 → 點餐 使用目前桌次而非舊單號', async ({ page }) => {
  await page.setContent(`<!doctype html><html lang="zh-Hant"><body>
    <h1>模擬流程</h1>
    <button type="button" id="fromApp">從 App 選餐點</button>
    <button type="button" id="order">點餐 ↗</button>
    <pre id="out"></pre>
  </body></html>`);
  await page.addScriptTag({ path: harnessPath });

  await page.evaluate(({ current, old, pwa }) => {
    const h = window.__orderUrlHelpers;
    // 設定裡仍是舊單號（重現 bug 的前提）
    window.__settings = { orderUrl: old };
    window.__opened = [];
    document.getElementById('fromApp').onclick = () => {
      const url = h.buildAppSelectUrl(pwa, current);
      window.__opened.push(url);
      // 模擬進入 App 並處理 #return=
      const r = h.applyIncomingReturnUrl(new URL(url).hash, window.__settings);
      if (r.applied) window.__settings.orderUrl = r.orderUrl;
      document.getElementById('out').textContent = JSON.stringify({
        opened: url,
        returnUrl: h.readReturnUrl(new URL(url).hash),
        resolved: h.resolveOrderUrl(window.__settings),
      });
    };
    document.getElementById('order').onclick = () => {
      const orderUrl = h.resolveOrderUrl(window.__settings);
      const token = h.encodeSets([{ id: 't', name: '測', savedAt: '2026-01-01T00:00:00.000Z', items: [{ item: '麥茶', qty: 1, comment: '', options: {} }] }]);
      const go = h.buildOrderUrl(orderUrl, token);
      document.getElementById('out').textContent = JSON.stringify({ orderUrl, go });
    };
  }, { current: CURRENT, old: OLD, pwa: PWA });

  await page.getByRole('button', { name: '從 App 選餐點' }).tap();
  let out = JSON.parse(await page.locator('#out').innerText());
  expect(out.returnUrl).toBe(CURRENT);
  expect(out.resolved).toBe(CURRENT);
  expect(out.opened).not.toContain('bbbbbbbb');

  await page.getByRole('button', { name: '點餐 ↗' }).tap();
  out = JSON.parse(await page.locator('#out').innerText());
  expect(out.orderUrl).toBe(CURRENT);
  expect(out.go.startsWith(CURRENT + '#coc=')).toBe(true);
  expect(out.go).not.toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});
