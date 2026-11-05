// 產生短書籤（loader）＋完整程式靜態 JS
// 短書籤在電小二頁（無 CSP）執行時，從 GitHub Pages 載入完整程式；之後更新不用重裝書籤。
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PWA_URL = process.env.POKE_PWA_URL || 'https://ssc1223.github.io/poke-oneclick/';
export const SCRIPT_PATH = 'bookmarklets/oneclick.js';
export const MAX_BOOKMARKLET_LENGTH = 300;

/** 正規化 PWA 根網址，結尾一定有 / */
export function normalizePwaUrl(url) {
  return String(url || '').replace(/\/?$/, '/');
}

/** 完整程式的靜態檔網址（不含快取參數） */
export function scriptUrlFor(pwaUrl = PWA_URL) {
  return normalizePwaUrl(pwaUrl) + SCRIPT_PATH;
}

// 和 seed/build.py 相同：保留這些字元不編碼，其餘用 encodeURIComponent
const SAFE = "()!*'~;,/?:@&=+$-_.#";
export function toBookmarklet(code) {
  let s = encodeURIComponent(code.trim());
  for (const ch of SAFE) s = s.split(encodeURIComponent(ch)).join(ch);
  return 'javascript:' + s;
}

/**
 * 短書籤：注入 <script src="…?時間戳">，載入失敗用繁中提示。
 * 必須保持純 ASCII 且不做 encodeURIComponent（否則 {} 等會膨脹），
 * 目標長度 ≤ 300，方便 Android Brave 貼到書籤網址欄。
 */
export function buildLoaderBookmarklet(scriptUrl) {
  if (/[^ -\x7e]/.test(scriptUrl) || scriptUrl.includes("'")) {
    throw new Error('scriptUrl 必須是不含單引號的 ASCII');
  }
  // 繁中用 \u 跳脫；訊息：載入一鍵點餐失敗，請確認網路
  const code = `(()=>{let s=document.createElement('script');s.src='${scriptUrl}?'+Date.now();s.onerror=()=>alert('\\u8f09\\u5165\\u4e00\\u9375\\u9ede\\u9910\\u5931\\u6557\\uff0c\\u8acb\\u78ba\\u8a8d\\u7db2\\u8def');document.head.appendChild(s)})()`;
  return 'javascript:' + code;
}

export async function bundleOneclick(pwaUrl = PWA_URL) {
  const r = await build({
    entryPoints: [join(root, 'src/bookmarklet/oneclick.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2018', 'safari12', 'chrome70'],
    charset: 'utf8',
    legalComments: 'none',
    define: { __PWA_URL__: JSON.stringify(normalizePwaUrl(pwaUrl)) },
  });
  return r.outputFiles[0].text;
}

export async function generateBookmarklets({ pwaUrl = PWA_URL } = {}) {
  const code = await bundleOneclick(pwaUrl);
  const scriptUrl = scriptUrlFor(pwaUrl);
  const oneclick = buildLoaderBookmarklet(scriptUrl);

  const genDir = join(root, 'src/generated');
  const pubDir = join(root, 'public', 'bookmarklets');
  mkdirSync(genDir, { recursive: true });
  mkdirSync(pubDir, { recursive: true });

  writeFileSync(join(genDir, 'oneclick.js'), code);
  writeFileSync(join(pubDir, 'oneclick.js'), code);

  const meta = {
    oneclick,
    scriptUrl,
    pwaUrl: normalizePwaUrl(pwaUrl),
    scriptBytes: Buffer.byteLength(code, 'utf8'),
  };
  writeFileSync(join(genDir, 'bookmarklets.json'), JSON.stringify(meta, null, 1));
  return meta;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const meta = await generateBookmarklets();
  console.log('短書籤已產生：', {
    length: meta.oneclick.length,
    scriptUrl: meta.scriptUrl,
    scriptBytes: meta.scriptBytes,
  });
  if (meta.oneclick.length > MAX_BOOKMARKLET_LENGTH) {
    console.error(`短書籤超過 ${MAX_BOOKMARKLET_LENGTH} 字元（目前 ${meta.oneclick.length}）`);
    process.exit(1);
  }
}
