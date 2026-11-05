// 建置後：產生 dist/sw.js（含檔案清單與版本雜湊），並輸出書籤純文字檔
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'dist');

const bm = JSON.parse(readFileSync(join(root, 'src/generated/bookmarklets.json'), 'utf8'));
mkdirSync(join(dist, 'bookmarklets'), { recursive: true });
writeFileSync(join(dist, 'bookmarklets/oneclick.txt'), bm.oneclick);

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(dist);
const hash = createHash('sha256');
const assets = ['./'];
for (const f of files.sort()) {
  const rel = relative(dist, f).split(sep).join('/');
  if (rel === 'sw.js' || rel.startsWith('bookmarklets/')) continue;
  hash.update(rel).update(readFileSync(f));
  assets.push('./' + rel);
}
const version = hash.digest('hex').slice(0, 12);
const sw = readFileSync(join(root, 'src/sw-template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__ASSETS__', JSON.stringify(assets));
writeFileSync(join(dist, 'sw.js'), sw);
// GitHub Pages：關閉 Jekyll 處理
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`sw.js 版本 ${version}，快取 ${assets.length} 個檔案`);
