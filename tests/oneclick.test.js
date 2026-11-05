// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { polyfillOffsetParent } from './setup-dom.js';
import { mountMockShop } from '../mock/mock-shop.js';
import { decideAction, readCocToken, stripCoc, defaultSetName, buildImportUrl } from '../src/bookmarklet/oneclick-core.js';
import { runOneClick } from '../src/bookmarklet/oneclick-app.js';
import { loadLocalSets } from '../src/bookmarklet/save-core.js';
import { cta } from '../src/bookmarklet/dom.js';
import { encodeSets, decodeInput } from '../src/shared/codec.js';
import cats from '../mock/menu-data.json';

const FAST = 0.01;
const PWA = 'https://example.test/poke-oneclick/';
const REC_OPTS = { timeout: 200, interval: 10 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tea = { item: '麥茶', qty: 2, comment: '', options: {}, price: 20 };
const openCard = (name) => [...document.querySelectorAll('[data-testid^="menuItems-item"]')].find((c) => c.querySelector('div[style*="web-text-md"]').textContent === name).click();
const panels = () => [...document.querySelectorAll('[data-poke-oneclick]')].map((h) => h.shadowRoot);
const findButton = (text) => panels().flatMap((r) => [...r.querySelectorAll('button')]).find((b) => b.textContent.includes(text));

// 測試用：記錄 open 呼叫，可模擬被擋下彈出視窗
const opener = (blocked = false) => {
  const calls = [];
  const fn = (u) => { calls.push(u); return blocked ? null : {}; };
  fn.calls = calls;
  return fn;
};
const base = (extra) => ({ pwaUrl: PWA, scale: FAST, skipHostCheck: true, report: false, recOpts: REC_OPTS, ...extra });

beforeAll(() => polyfillOffsetParent(window));
beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});
afterEach(() => {
  if (window.__pokeRec) { window.__pokeRec.stop(); window.__pokeRec = null; }
  document.querySelectorAll('[data-poke-oneclick]').forEach((e) => e.remove());
});

describe('合併書籤：判斷邏輯（純函式）', () => {
  it('有 #coc= 一律還原點餐，即使正在記錄', () => {
    expect(decideAction({ hash: '#coc=abc', recorded: 0 })).toBe('restore');
    expect(decideAction({ hash: '#x=1&coc=abc', recorded: 3 })).toBe('restore');
  });
  it('沒有 #coc=：購物車有記錄到品項就存檔，空的就顯示選單', () => {
    expect(decideAction({ hash: '', recorded: 2 })).toBe('save');
    expect(decideAction({ hash: '#menu', recorded: 0 })).toBe('menu');
    expect(decideAction({ hash: '#coc=', recorded: 0 })).toBe('menu');
    expect(decideAction()).toBe('menu');
  });
  it('readCocToken / stripCoc', () => {
    expect(readCocToken('#coc=AbC_-1')).toBe('AbC_-1');
    expect(readCocToken('#a=1&coc=xyz&b=2')).toBe('xyz');
    expect(readCocToken('#import=xyz')).toBeNull();
    expect(stripCoc('#coc=abc')).toBe('');
    expect(stripCoc('#coc=abc&tab=2')).toBe('#tab=2');
    expect(stripCoc('#tab=2&coc=abc')).toBe('#tab=2');
  });
  it('defaultSetName 以第一份品項與總份數命名', () => {
    const d = new Date(2026, 10, 5);
    expect(defaultSetName([{ item: '創意自選波奇', qty: 1 }, tea], d)).toBe('創意自選波奇 等 3 份 11/5');
    expect(defaultSetName([{ item: '麥茶', qty: 1 }], d)).toBe('麥茶 11/5');
  });
  it('buildImportUrl 產生 #import= 網址，且可被 App 解碼', () => {
    const set = { id: 'a1', name: '測試', savedAt: '2026-11-05T00:00:00Z', items: [tea] };
    const u = buildImportUrl(PWA + '#/settings', set);
    expect(u.startsWith(PWA + '#import=')).toBe(true);
    expect(decodeInput(u).sets[0]).toMatchObject({ name: '測試', items: [{ item: '麥茶', qty: 2 }] });
  });
});

describe('合併書籤：在模擬電小二頁面上', () => {
  it('網址有 #coc= → 自動還原點餐，並把 #coc= 從網址移除', async () => {
    const shop = mountMockShop(document, cats, { announcement: false });
    history.replaceState(null, '', '/#coc=' + encodeSets([{ name: '下午茶', items: [tea] }]));
    const res = await runOneClick(base({ confirm: async () => ({ mode: 'cancel' }) }));
    expect(res.action).toBe('restore');
    expect(res.res.ok).toEqual(['麥茶 x2']);
    expect(shop.cart).toEqual([{ item: '麥茶', qty: 2, comment: '', options: {} }]);
    expect(shop.checkoutClicked).toBe(false);
    expect(location.hash).toBe('');
  });

  it('#coc= 還原時保留變動提示（價格變動 → 取消就不加入）', async () => {
    const shop = mountMockShop(document, cats, { announcement: false, price: { 麥茶: 25 } });
    history.replaceState(null, '', '/#coc=' + encodeSets([{ name: 't', items: [tea] }]));
    const seen = [];
    const res = await runOneClick(base({ confirm: async (issues) => { seen.push(...issues.map((i) => i.kind)); return { mode: 'cancel' }; } }));
    expect(seen).toEqual(['item-price']);
    expect(res.res.cancelled).toBe(true);
    expect(shop.cart).toEqual([]);
  });

  it('購物車為空 → 顯示簡單選單並開始記錄；「從 App 選餐點」會開 App', async () => {
    mountMockShop(document, cats, { announcement: false });
    const open = opener();
    let menu;
    const p = runOneClick(base({ open, onMenu: (m) => { menu = m; } }));
    await wait(0);
    expect(menu).toBeTruthy();
    expect(window.__pokeRec).toBeTruthy(); // 背景已開始記錄
    menu.root.querySelector('[data-act=app]').click();
    const res = await p;
    expect(res.action).toBe('menu');
    expect(open.calls).toEqual([PWA]);
  });

  it('記錄後再按一次書籤 → 存成餐點並直接開 App 的 #import= 自動匯入', async () => {
    const shop = mountMockShop(document, cats, { announcement: false });
    const open = opener();
    // 第一次按：選單 → 關閉，繼續點餐
    const p = runOneClick(base({ open, onMenu: (m) => m.root.querySelector('[data-act=close]').click() }));
    expect((await p).action).toBe('menu');
    // 照平常加入購物車
    openCard('麥茶');
    document.querySelector('#itemModal [data-testid^=attributeQuantityEditor-add]').click();
    cta().click();
    await wait(50);
    expect(shop.cart).toHaveLength(1);
    // 第二次按：直接存檔並開 App
    const res = await runOneClick(base({ open }));
    expect(res.action).toBe('save');
    expect(res.opened).toBe(true);
    expect(open.calls).toHaveLength(1);
    expect(open.calls[0].startsWith(PWA + '#import=')).toBe(true);
    const imported = decodeInput(open.calls[0]).sets[0];
    expect(imported.items).toEqual([expect.objectContaining({ item: '麥茶', qty: 2, price: 20 })]);
    expect(imported.name).toMatch(/^麥茶 等 2 份 \d+\/\d+$/);
    expect(loadLocalSets()[0].name).toBe(imported.name); // 也存在這個瀏覽器
    expect(window.__pokeRec).toBeNull(); // 存完就停止記錄
  });

  it('彈出視窗被擋下時，改顯示「開啟 App 匯入」按鈕', async () => {
    mountMockShop(document, cats, { announcement: false });
    await runOneClick(base({ open: opener(), onMenu: (m) => m.root.querySelector('[data-act=close]').click() }));
    openCard('麥茶');
    cta().click();
    await wait(50);
    const res = await runOneClick(base({ open: opener(true) }));
    expect(res.action).toBe('save');
    expect(res.opened).toBe(false);
    const link = panels().flatMap((r) => [...r.querySelectorAll('a')]).find((a) => a.textContent.includes('開啟 App 匯入'));
    expect(link.getAttribute('href')).toBe(res.url);
  });

  it('記錄中按 #coc= 還原時，自動點的品項不會被記成新餐點', async () => {
    mountMockShop(document, cats, { announcement: false });
    await runOneClick(base({ open: opener(), onMenu: (m) => m.root.querySelector('[data-act=close]').click() }));
    expect(window.__pokeRec).toBeTruthy();
    history.replaceState(null, '', '/#coc=' + encodeSets([{ name: 't', items: [tea] }]));
    const res = await runOneClick(base({ confirm: async () => ({ mode: 'cancel' }) }));
    expect(res.res.ok).toEqual(['麥茶 x2']);
    expect(window.__pokeRec).toBeNull();
    expect(loadLocalSets()).toEqual([]);
  });

  it('記錄條上的「存成餐點」和再按一次書籤效果相同', async () => {
    mountMockShop(document, cats, { announcement: false });
    const open = opener();
    await runOneClick(base({ open, onMenu: (m) => m.root.querySelector('[data-act=close]').click() }));
    openCard('麥茶');
    cta().click();
    await wait(50);
    findButton('存成餐點').click();
    expect(open.calls).toHaveLength(1);
    expect(decodeInput(open.calls[0]).sets[0].items[0].item).toBe('麥茶');
  });
});
