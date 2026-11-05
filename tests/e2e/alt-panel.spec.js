import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const harnessPath = join(root, 'tests/e2e/fixtures/harness-alt-panel.js');

const SAMPLE_ISSUES = [{
  kind: 'item-renamed',
  item: '麥茶',
  index: 0,
  suggestions: [{ name: '冰麥茶', score: 0.92 }],
  choices: ['冰麥茶', '檸檬汁', '綠茶'],
}];

test.beforeAll(async () => {
  mkdirSync(dirname(harnessPath), { recursive: true });
  await build({
    entryPoints: [join(root, 'tests/e2e/harness-alt-panel.js')],
    bundle: true,
    format: 'iife',
    outfile: harnessPath,
    target: ['es2018'],
    charset: 'utf8',
    legalComments: 'none',
  });
});

async function openPanel(page, { withBootstrapModal = true } = {}) {
  const modalHtml = withBootstrapModal ? `
    <div class="modal fade show" id="shopModal" style="display:block;position:fixed;inset:0;z-index:1055;background:rgba(0,0,0,.45)">
      <div class="modal-dialog" style="margin:20vh auto;max-width:400px;background:#fff;padding:24px;border-radius:8px">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">電小二選項視窗</h5></div>
          <div class="modal-body">
            <p>底下的 Bootstrap .modal.show（模擬點餐選項視窗搶焦點）</p>
            <select id="trapSelect"><option>不該被點到</option><option>B</option></select>
            <input id="trapInput" value="focus-trap">
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show" style="position:fixed;inset:0;z-index:1050;background:#000;opacity:.5"></div>
  ` : '';

  await page.setContent(`<!doctype html><html lang="zh-Hant"><body style="margin:0;min-height:100vh;background:#f5f5f5">
    ${modalHtml}
    <main><h1>模擬電小二點餐頁</h1><p>用來測替代方案面板的觸控選取</p></main>
  </body></html>`);
  await page.addScriptTag({ path: harnessPath });
  await page.evaluate((issues) => { window.runAltPanel(issues, 'menu'); }, SAMPLE_ISSUES);
  await expect(page.locator('[data-poke-oneclick]')).toHaveCount(1);
}

test('觸控可選替代品項並套用（含 Bootstrap .modal.show）', async ({ page }) => {
  await openPanel(page, { withBootstrapModal: true });
  expect(await page.locator('.modal.show').count()).toBeGreaterThan(0);

  // Playwright 預設可穿透 open shadow DOM；用 tap 模擬觸控
  const lemon = page.getByRole('button', { name: '改用：檸檬汁' });
  await expect(lemon).toBeVisible();
  await lemon.tap();
  await expect(lemon).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '用建議替代' }).tap();
  const result = await page.waitForFunction(() => window.__altResult);
  const value = await result.jsonValue();
  expect(value).toEqual({ mode: 'replace', picks: { 0: '檸檬汁' } });
});

test('預設建議可直接「用建議替代」', async ({ page }) => {
  await openPanel(page, { withBootstrapModal: true });
  await expect(page.getByRole('button', { name: '建議改用：冰麥茶' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '用建議替代' }).tap();
  const result = await page.waitForFunction(() => window.__altResult);
  expect(await result.jsonValue()).toEqual({ mode: 'replace', picks: { 0: '冰麥茶' } });
});

test('可點「這項略過」再略過繼續', async ({ page }) => {
  await openPanel(page, { withBootstrapModal: false });
  await page.getByRole('button', { name: '這項略過' }).tap();
  await expect(page.getByRole('button', { name: '這項略過' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '略過繼續' }).tap();
  const result = await page.waitForFunction(() => window.__altResult);
  expect(await result.jsonValue()).toEqual({ mode: 'skip', picks: { 0: '' } });
});
