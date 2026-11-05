// 把 E2E harness 打成單一 IIFE，供 Playwright page.addScriptTag 使用
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests/e2e/fixtures/harness-alt-panel.js');
mkdirSync(dirname(out), { recursive: true });
await build({
  entryPoints: [join(root, 'tests/e2e/harness-alt-panel.js')],
  bundle: true,
  format: 'iife',
  outfile: out,
  target: ['es2018'],
  charset: 'utf8',
  legalComments: 'none',
});
console.log('E2E harness →', out);
