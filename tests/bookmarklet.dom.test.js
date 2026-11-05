// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { polyfillOffsetParent } from './setup-dom.js';
import { mountMockShop } from '../mock/mock-shop.js';
import { runRestore, ensureModalsClosed, makeTiming } from '../src/bookmarklet/restore-core.js';
import { startRecording, saveLocalSet, loadLocalSets } from '../src/bookmarklet/save-core.js';
import { snapshotMenu, snapshotGroups, groups, cta, parseAddOn, parsePrice, KEY, anyModalOpen, modalTitle, modalItemName, modalShowsItem } from '../src/bookmarklet/dom.js';

import cats from '../mock/menu-data.json';
const FAST = 0.01;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const REC_OPTS = { timeout: 200, interval: 10 };
const openCard = (name) => [...document.querySelectorAll('[data-testid^="menuItems-item"]')].find((c) => c.querySelector('div[style*="web-text-md"]').textContent === name).click();

const myPoke = {
  item: '創意自選波奇', qty: 1, comment: '醬少一點',
  options: {
    基底選一: ['糙米'], 醬汁選一: ['經典波奇【全素】'],
    配菜選六: ['玉米', '洋蔥', '黃瓜', '毛豆', '海藻沙拉', '藜麥'],
    配料選二: ['海苔', '芝麻'], 蛋白質自選: ['鮪魚(生)'], 加點蛋白質: ['挪威鮭魚(生)', '挪威鮭魚(生)'],
    醬料放置: ['醬料另外放'], 基底量: ['基底量正常'],
  },
  price: 125, optPrices: { 加點蛋白質: { '挪威鮭魚(生)': 65 } },
};
const tea = { item: '麥茶', qty: 2, comment: '', options: {}, price: 20 };
const fish = { item: '招牌奶香芥末鮭魚飯', qty: 1, comment: '', options: { 基底選一: ['白米'], 醬料選擇: ['醬料直接放'], 基底量: ['基底量多 【限全飯】'] } };
// 「基底選一(組)」才是正確群組名稱，故意寫錯一個看看會不會被建議

beforeAll(() => polyfillOffsetParent(window));
beforeEach(() => localStorage.clear());

const answer = (mode, log) => async (issues, stage) => { log && log.push({ stage, kinds: issues.map((i) => i.kind) }); return { mode, picks: {} }; };

describe('一鍵點餐（模擬電小二頁面）', () => {
  it('依紀錄加入購物車：選項、數量、加點兩份、備註都正確，且不會按結帳', async () => {
    const shop = mountMockShop(document, cats);
    const log = [];
    const res = await runRestore({ name: 't', items: [myPoke, tea] }, { confirm: answer('skip', log), scale: FAST });
    expect(log).toEqual([]);
    expect(res.bad).toEqual([]);
    expect(res.ok).toEqual(['創意自選波奇 x1', '麥茶 x2']);
    expect(shop.cart).toHaveLength(2);
    const [p, t] = shop.cart;
    expect(p.comment).toBe('醬少一點');
    expect(p.options['加點蛋白質']).toEqual(['挪威鮭魚(生)', '挪威鮭魚(生)']);
    expect(p.options['配菜選六'].sort()).toEqual([...myPoke.options['配菜選六']].sort());
    expect(p.options['醬汁選一']).toEqual(['經典波奇【全素】']);
    expect(t).toMatchObject({ item: '麥茶', qty: 2 });
    expect(shop.checkoutClicked).toBe(false);
    expect(document.getElementById('ann')).toBeNull(); // 「我知道了」已被關掉
  });

  it('預設已勾的固定配菜會先取消再勾（沿用 seed 邏輯）', async () => {
    const shop = mountMockShop(document, cats);
    const combo = { item: '夏威夷經典鮪魚飯', qty: 1, options: { '基底選一(組)': ['白米 糙米'], 醬料選擇: ['醬料另外放'], 基底量: ['基底量少'], '基本配菜(鮪魚)': ['洋蔥', '黃瓜(組)', '毛豆', '海藻沙拉', '青蔥'] } };
    const res = await runRestore({ items: [combo] }, { confirm: answer('skip'), scale: FAST });
    expect(res.ok).toEqual(['夏威夷經典鮪魚飯 x1']);
    expect(shop.cart[0].options['基底選一(組)']).toEqual(['白米 糙米']);
  });

  it('品項改名：選「用建議替代」會改點新名稱', async () => {
    const shop = mountMockShop(document, cats, { rename: { 麥茶: '冰麥茶' } });
    const log = [];
    const res = await runRestore({ items: [tea] }, { confirm: answer('replace', log), scale: FAST });
    expect(log[0]).toEqual({ stage: 'menu', kinds: ['item-renamed'] });
    expect(shop.cart.map((x) => x.item)).toEqual(['冰麥茶']);
    expect(res.ok).toEqual(['冰麥茶 x2']);
  });

  it('執行前已開著選項視窗時：先關閉再點餐，兩份都加入且報告與購物車一致', async () => {
    // 貼近真實電小二：.modal.show + backdrop 擋住菜單；紀錄裡「冰麥茶」在菜單上是「麥茶」，改選「輕柚冰茶」
    const shop = mountMockShop(document, cats, { announcement: false });
    openCard('麥茶');
    expect(anyModalOpen()).toBe(true);
    expect(modalTitle()).toBe('數量編輯');
    expect(modalItemName()).toBe('麥茶');
    // 開著視窗時點其他卡片無效（以前 mock 會直接切換，蓋住這個 bug）
    openCard('創意自選波奇');
    expect(modalItemName()).toBe('麥茶');

    const iced = { item: '冰麥茶', qty: 1, comment: '', options: {}, price: 20 };
    const res = await runRestore(
      { name: '實測', items: [myPoke, iced] },
      {
        confirm: async (issues, stage) => {
          expect(stage).toBe('menu');
          const k = issues.findIndex((i) => i.item === '冰麥茶');
          expect(k).toBeGreaterThanOrEqual(0);
          expect(issues[k].choices).toContain('輕柚冰茶');
          return { mode: 'replace', picks: { [k]: '輕柚冰茶' } };
        },
        scale: FAST,
      },
    );

    expect(res.cancelled).toBe(false);
    expect(res.bad).toEqual([]);
    expect(res.ok).toEqual(['創意自選波奇 x1', '輕柚冰茶 x1']);
    expect(shop.cart.map((x) => x.item)).toEqual(['創意自選波奇', '輕柚冰茶']);
    expect(shop.cart[0].options['配菜選六'].sort()).toEqual([...myPoke.options['配菜選六']].sort());
    expect(anyModalOpen()).toBe(false);
    expect(shop.checkoutClicked).toBe(false);
  });

  it('真實 DOM：.modal-title 是數量編輯時仍能還原（品名在 body）', async () => {
    const shop = mountMockShop(document, cats, { announcement: false });
    openCard('輕柚冰茶');
    expect(modalTitle()).toBe('數量編輯');
    expect(modalItemName()).toBe('輕柚冰茶');
    expect(modalShowsItem('輕柚冰茶')).toBe(true);
    expect(modalShowsItem('創意自選波奇')).toBe(false);
    document.querySelector('.modal.show .btn-close').click();

    const iced = { item: '冰麥茶', qty: 1, comment: '', options: {}, price: 20 };
    const res = await runRestore(
      { name: '無前置視窗', items: [myPoke, iced] },
      {
        confirm: async (issues) => {
          const k = issues.findIndex((i) => i.item === '冰麥茶');
          return { mode: 'replace', picks: { [k]: '輕柚冰茶' } };
        },
        scale: FAST,
      },
    );
    expect(res.bad).toEqual([]);
    expect(res.ok).toEqual(['創意自選波奇 x1', '輕柚冰茶 x1']);
    expect(shop.cart.map((x) => x.item)).toEqual(['創意自選波奇', '輕柚冰茶']);
  });

  it('ensureModalsClosed 會關掉手動開啟的視窗', async () => {
    mountMockShop(document, cats, { announcement: false });
    openCard('麥茶');
    expect(anyModalOpen()).toBe(true);
    const ok = await ensureModalsClosed(makeTiming(FAST));
    expect(ok).toBe(true);
    expect(anyModalOpen()).toBe(false);
  });

  it('品項下架／售完：選「略過繼續」只點其他品項', async () => {
    const shop = mountMockShop(document, cats, { remove: ['麥茶'], soldOut: ['檸檬汁'] });
    expect(snapshotMenu().find((m) => m.name === '檸檬汁').soldOut).toBe(true);
    const log = [];
    const res = await runRestore({ items: [tea, { item: '檸檬汁', options: {} }, { item: '味噌湯', options: {} }] }, { confirm: answer('skip', log), scale: FAST });
    expect(log[0].kinds).toHaveLength(2);
    expect(log[0].kinds).toContain('item-soldout');
    expect(log[0].kinds.some((k) => k === 'item-missing' || k === 'item-renamed')).toBe(true);
    expect(shop.cart.map((x) => x.item)).toEqual(['味噌湯']);
    expect(res.bad.join()).toContain('已略過');
  });

  it('價格變動會提示；選「取消」就完全不加入', async () => {
    const shop = mountMockShop(document, cats, { price: { 麥茶: 25 } });
    const log = [];
    const res = await runRestore({ items: [tea] }, { confirm: answer('cancel', log), scale: FAST });
    expect(log[0].kinds).toEqual(['item-price']);
    expect(res.cancelled).toBe(true);
    expect(shop.cart).toEqual([]);
  });

  it('選項售完／不見／加價變動：用建議替代後成功加入', async () => {
    const shop = mountMockShop(document, cats, {
      optionSoldOut: [['創意自選波奇', '醬汁選一', '經典波奇【全素】']],
      optionRename: [['創意自選波奇', '配菜選六', '黃瓜', '小黃瓜']],
    });
    // 價格變動：紀錄是 +60，菜單是 +65
    const rec = { ...myPoke, optPrices: { 加點蛋白質: { '挪威鮭魚(生)': 60 } } };
    const log = [];
    const res = await runRestore({ items: [rec] }, {
      confirm: async (issues, stage) => {
        log.push({ stage, kinds: issues.map((i) => i.kind) });
        // 醬汁沒有名稱相近的替代 → 使用者從 choices 手動挑一個；黃瓜用預設建議
        const k = issues.findIndex((i) => i.kind === 'option-soldout');
        expect(issues[k].suggestions).toEqual([]);
        expect(issues[k].choices).toContain('和風柚香 【全素】');
        return { mode: 'replace', picks: { [k]: '和風柚香 【全素】' } };
      },
      scale: FAST,
    });
    expect(log[0].stage).toBe('options');
    expect(log[0].kinds.sort()).toEqual(['option-missing', 'option-price', 'option-soldout']);
    expect(res.ok).toEqual(['創意自選波奇 x1']);
    expect(shop.cart[0].options['配菜選六']).toContain('小黃瓜');
    expect(shop.cart[0].options['醬汁選一']).toEqual(['和風柚香 【全素】']);
  });

  it('選項不見又選略過，必選數量不足時會停下並回報，不會亂按', async () => {
    const shop = mountMockShop(document, cats, { optionRemove: [['創意自選波奇', '配菜選六', '黃瓜']] });
    const res = await runRestore({ items: [myPoke, tea] }, { confirm: answer('skip'), scale: FAST });
    expect(shop.cart).toEqual([]);
    expect(res.bad[0]).toContain('無法加入');
    expect(shop.checkoutClicked).toBe(false);
  });

  it('群組名稱錯誤時建議相近群組', async () => {
    const shop = mountMockShop(document, cats);
    const log = [];
    await runRestore({ items: [fish] }, { confirm: async (issues) => { log.push(issues); return { mode: 'replace', picks: {} }; }, scale: FAST });
    expect(log[0][0]).toMatchObject({ kind: 'group-missing', group: '基底選一' });
    expect(log[0][0].suggestions[0].name).toBe('基底選一(組)');
    expect(shop.cart[0].options['基底選一(組)']).toEqual(['白米']);
  });
});

describe('存餐點（模擬電小二頁面）', () => {
  it('攔截「加入購物車」記下品項、價格、選項、加價、數量、備註，並可還原', async () => {
    const shop = mountMockShop(document, cats, { announcement: false });
    const rec = startRecording(null, REC_OPTS);
    // 模擬使用者手動點一次
    const card = [...document.querySelectorAll('[data-testid^="menuItems-item"]')].find((c) => c.textContent.includes('創意自選波奇'));
    card.click();
    const pick = (group, opt) => {
      const g = [...document.querySelectorAll('.attribute-category-title')].find((t) => t.textContent === group).parentElement.parentElement;
      const row = [...g.querySelectorAll('.px-3')].find((r) => r.querySelector('.attribute-option-title').textContent === opt);
      (row.querySelector('input[type=radio],input[type=checkbox]') || row.querySelector('[data-testid^=quantityCounter-plus]')).click();
    };
    for (const [g, list] of Object.entries(myPoke.options)) for (const o of list) pick(g, o);
    document.querySelector('#itemModal [data-testid^=attributeQuantityEditor-add]').click();
    const ta = document.querySelector('#itemModal textarea[data-testid=comment]');
    ta.value = '醬少一點';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    cta().click();
    expect(shop.cart).toHaveLength(1);
    await wait(50);
    rec.stop();
    expect(rec.list).toHaveLength(1);
    const r = rec.list[0];
    expect(r).toMatchObject({ item: '創意自選波奇', qty: 2, comment: '醬少一點', price: 125 });
    expect(r.options['加點蛋白質']).toEqual(['挪威鮭魚(生)', '挪威鮭魚(生)']);
    expect(r.optPrices['加點蛋白質']['挪威鮭魚(生)']).toBe(65);
    expect(r.optPrices['蛋白質自選']['鮪魚(生)']).toBe(35);
    expect(r.options['加點配菜']).toEqual([]);

    const set = saveLocalSet('小明的鮮魚波奇', rec.list);
    expect(JSON.parse(localStorage.getItem(KEY)).v).toBe(1);
    expect(loadLocalSets()[0].name).toBe('小明的鮮魚波奇');

    // 用剛存的紀錄再點一次，結果要和手動點的一樣
    const shop2 = mountMockShop(document, cats, { announcement: false });
    const res = await runRestore(set, { confirm: answer('cancel'), scale: FAST });
    expect(res.ok).toEqual(['創意自選波奇 x2']);
    expect(shop2.cart[0]).toEqual(shop.cart[0]);
  });

  it('網站拒絕加入（必選項沒選完、視窗沒關）時不記錄並提示', async () => {
    const shop = mountMockShop(document, cats, { announcement: false });
    const added = [];
    const rejected = [];
    const rec = startRecording((r) => added.push(r), { ...REC_OPTS, onReject: (r) => rejected.push(r) });
    openCard('創意自選波奇');
    cta().click(); // 什麼都沒選就按
    expect(shop.errors).toHaveLength(1);
    await wait(REC_OPTS.timeout + 100);
    expect(rec.list).toEqual([]);
    expect(added).toEqual([]);
    expect(rejected.map((r) => r.item)).toEqual(['創意自選波奇']);
    // 視窗仍開著，關掉後改點麥茶，成功加入就會記下
    document.querySelector('.modal.show .btn-close').click();
    openCard('麥茶');
    cta().click();
    await wait(50);
    rec.stop();
    expect(rec.list.map((r) => [r.item, r.price])).toEqual([['麥茶', 20]]);
    expect(added).toHaveLength(1);
  });

  it('讀得懂 seed 舊版 localStorage 格式', () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: '2026-01-01T00:00:00Z', items: [{ item: '麥茶', qty: 1, options: {} }] }));
    expect(loadLocalSets()[0].items[0].item).toBe('麥茶');
  });
});

describe('真實網站 DOM 格式解析', () => {
  it('卡片價格與大卡分開的 div：麥茶是 20 而不是 203', () => {
    mountMockShop(document, cats, { announcement: false });
    const card = [...document.querySelectorAll('[data-testid^="menuItems-item"]')].find((c) => c.textContent.trim().startsWith('麥茶'));
    expect(card.textContent).toContain('$203.7 大卡'); // 確認 mock 真的黏在一起
    const tea = snapshotMenu().find((m) => m.name === '麥茶');
    expect(tea.price).toBe(20);
    expect(snapshotMenu().find((m) => m.name === '創意自選波奇').price).toBe(125);
  });

  it('選項加價「$65」格式（後面緊接大卡）解析為 65；沒加價的是 0', () => {
    mountMockShop(document, cats, { announcement: false });
    openCard('創意自選波奇');
    const gs = snapshotGroups();
    const add = gs.find((g) => g.title === '加點蛋白質');
    expect(add.options.find((o) => o.name === '挪威鮭魚(生)').price).toBe(65);
    expect(gs.find((g) => g.title === '蛋白質自選').options.find((o) => o.name === '鮪魚(生)').price).toBe(35);
    expect(gs.find((g) => g.title === '加點配料').options.find((o) => o.name === '海苔').price).toBe(5);
    expect(gs.find((g) => g.title === '基底選一').options.every((o) => o.price === 0)).toBe(true);
  });

  it('保留舊版「+$45」加價格式', () => {
    mountMockShop(document, cats, { announcement: false, addOnFormat: 'plus' });
    openCard('創意自選波奇');
    const add = snapshotGroups().find((g) => g.title === '加點蛋白質');
    expect(add.options.find((o) => o.name === '挪威鮭魚(生)').price).toBe(65);
  });

  it('parseAddOn / parsePrice 各種格式', () => {
    expect(parseAddOn('$65')).toBe(65);
    expect(parseAddOn('+45')).toBe(45);
    expect(parseAddOn('+$45')).toBe(45);
    expect(parseAddOn('(+45)')).toBe(45);
    expect(parseAddOn('120.5 大卡')).toBe(0);
    expect(parseAddOn('3.7 大卡\n$35')).toBe(35);
    expect(parsePrice('NT$1,200')).toBe(1200);
  });

  it('只取目前顯示中的 .modal.show：忽略隱藏的 CTA 與隱藏視窗', () => {
    mountMockShop(document, cats, { announcement: false });
    expect(document.querySelectorAll('[data-testid=attributeCTALayout]').length).toBeGreaterThanOrEqual(3);
    expect(document.querySelectorAll('.modal').length).toBeGreaterThanOrEqual(2);
    expect(cta()).toBeNull(); // 沒有打開的視窗時不會抓到隱藏的 CTA
    expect(groups()).toEqual([]);
    openCard('創意自選波奇');
    expect(cta().closest('.modal.show')).not.toBeNull();
    const titles = groups().map((g) => g.title);
    expect(titles).toContain('加點蛋白質');
    expect(titles).not.toContain('隱藏群組');
  });
});
