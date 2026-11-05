// 把 src/bookmarklet/oneclick.js 打包成單一 javascript: 書籤
// （對應 seed/build.py 的做法：組合 → 壓縮 → URL 編碼）
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PWA_URL = process.env.POKE_PWA_URL || 'https://ssc1223.github.io/poke-oneclick/';

// 和 seed/build.py 相同：保留這些字元不編碼，其餘用 encodeURIComponent
const SAFE = "()!*'~;,/?:@&=+$-_.#";
export function toBookmarklet(code) {
  let s = encodeURIComponent(code.trim());
  for (const ch of SAFE) s = s.split(encodeURIComponent(ch)).join(ch);
  return 'javascript:' + s;
}

const out = {};
const sizes = {};
for (const name of ['oneclick']) {
  const r = await build({
    entryPoints: [join(root, 'src/bookmarklet', name + '.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2018', 'safari12', 'chrome70'],
    charset: 'ascii', // 中文轉成 \uXXXX，避免書籤網址被 UTF-8 百分比編碼放大
    legalComments: 'none',
    define: { __PWA_URL__: JSON.stringify(PWA_URL) },
  });
  const code = r.outputFiles[0].text;
  out[name] = toBookmarklet(code);
  sizes[name] = out[name].length;
}
mkdirSync(join(root, 'src/generated'), { recursive: true });
writeFileSync(join(root, 'src/generated/bookmarklets.json'), JSON.stringify({ ...out, pwaUrl: PWA_URL }, null, 1));
console.log('書籤已產生：', sizes, 'PWA_URL =', PWA_URL);
