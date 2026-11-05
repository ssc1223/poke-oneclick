import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toBookmarklet,
  buildLoaderBookmarklet,
  generateBookmarklets,
  scriptUrlFor,
  normalizePwaUrl,
  MAX_BOOKMARKLET_LENGTH,
  SCRIPT_PATH,
} from '../scripts/build-bookmarklets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PWA = 'https://ssc1223.github.io/poke-oneclick/';

describe('短書籤 loader', () => {
  it('toBookmarklet 以 javascript: 開頭', () => {
    expect(toBookmarklet('alert(1)')).toBe('javascript:alert(1)');
  });

  it('scriptUrlFor 組出正確靜態檔網址', () => {
    expect(scriptUrlFor(PWA)).toBe(`${PWA}${SCRIPT_PATH}`);
    expect(scriptUrlFor('https://example.com/poke-oneclick')).toBe(`https://example.com/poke-oneclick/${SCRIPT_PATH}`);
  });

  it('normalizePwaUrl 保證結尾斜線', () => {
    expect(normalizePwaUrl('https://x.test/a')).toBe('https://x.test/a/');
    expect(normalizePwaUrl('https://x.test/a/')).toBe('https://x.test/a/');
  });

  it('短書籤長度在 300 字元以內，且會載入完整程式並帶快取參數', () => {
    const url = scriptUrlFor(PWA);
    const bm = buildLoaderBookmarklet(url);
    expect(bm.startsWith('javascript:')).toBe(true);
    expect(bm.length).toBeLessThanOrEqual(MAX_BOOKMARKLET_LENGTH);
    expect(bm.length).toBeLessThanOrEqual(300);
    // 純 ASCII、未再百分比編碼，貼上長度＝字串長度
    expect(/^[\x20-\x7e]+$/.test(bm)).toBe(true);
    const body = bm.slice('javascript:'.length);
    expect(body).toContain(url);
    expect(body).toContain('Date.now()');
    expect(body).toContain("createElement('script')");
    expect(body).toMatch(/\\u8f09\\u5165/); // 「載入」
    expect(body).toContain('onerror');
  });
});

describe('建置輸出：完整程式檔', () => {
  let meta;
  beforeAll(async () => {
    meta = await generateBookmarklets({ pwaUrl: PWA });
  }, 30000);

  it('產生的短書籤 ≤ 300 字，並寫入 bookmarklets.json', () => {
    expect(meta.oneclick.length).toBeLessThanOrEqual(300);
    expect(meta.scriptUrl).toBe(scriptUrlFor(PWA));
    const json = JSON.parse(readFileSync(join(root, 'src/generated/bookmarklets.json'), 'utf8'));
    expect(json.oneclick).toBe(meta.oneclick);
    expect(json.oneclick.length).toBeLessThanOrEqual(300);
  });

  it('完整程式檔輸出到 src/generated 與 public（建置會進 dist）', () => {
    const gen = join(root, 'src/generated/oneclick.js');
    const pub = join(root, 'public/bookmarklets/oneclick.js');
    expect(existsSync(gen)).toBe(true);
    expect(existsSync(pub)).toBe(true);
    const code = readFileSync(gen, 'utf8');
    expect(statSync(gen).size).toBeGreaterThan(1000);
    expect(code).toContain('加入購物車'); // 完整功能仍在檔內
    expect(readFileSync(pub, 'utf8')).toBe(code);
  });
});

describe('npm run build 建置結果', () => {
  const distJs = join(root, 'dist/bookmarklets/oneclick.js');
  const distTxt = join(root, 'dist/bookmarklets/oneclick.txt');

  it('dist 含短書籤文字檔與完整程式 JS，且短書籤 ≤ 300 字', async () => {
    // 若尚未建置則先建；CI 會再跑一次 build，這裡確保測試能獨立驗證輸出
    const { execSync } = await import('node:child_process');
    execSync('npm run build', { cwd: root, stdio: 'pipe', env: { ...process.env, POKE_PWA_URL: PWA } });
    expect(existsSync(distJs)).toBe(true);
    expect(existsSync(distTxt)).toBe(true);
    const shortBm = readFileSync(distTxt, 'utf8');
    expect(shortBm.startsWith('javascript:')).toBe(true);
    expect(shortBm.length).toBeLessThanOrEqual(300);
    const full = readFileSync(distJs, 'utf8');
    expect(full.length).toBeGreaterThan(1000);
    expect(full).toContain('加入購物車');
    expect(shortBm).toContain('bookmarklets/oneclick.js');
  }, 120000);
});
