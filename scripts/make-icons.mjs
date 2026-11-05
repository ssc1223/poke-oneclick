// 開發用：由 public/icons/icon.svg 產生 PNG 圖示（需要 Playwright；產物已提交到 repo，CI 不需執行）
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const p = await b.newPage();
// square：去掉圓角（iOS 與 maskable 會自己裁切）；pad：maskable 安全區留白
const shot = async (size, file, { square = false, pad = 0 } = {}) => {
  await p.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  let s = svg.replace('<svg ', `<svg width="${inner}" height="${inner}" style="display:block" `);
  if (square) s = s.replace('rx="112"', 'rx="0"');
  await p.setContent(`<body style="margin:0;background:${square ? '#e8590c' : 'transparent'}"><div style="padding:${pad}px">${s}</div></body>`);
  await p.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: !square });
};
await shot(192, 'icon-192.png');
await shot(512, 'icon-512.png');
await shot(180, 'apple-touch-icon.png', { square: true });
await shot(512, 'icon-maskable-512.png', { square: true, pad: 56 });
await b.close();
