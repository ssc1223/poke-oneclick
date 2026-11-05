// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { polyfillOffsetParent } from './setup-dom.js';
import { mountMockShop } from '../mock/mock-shop.js';
import { runRestore } from '../src/bookmarklet/restore-core.js';
import { startRecording, saveLocalSet, loadLocalSets } from '../src/bookmarklet/save-core.js';
import { snapshotMenu, KEY } from '../src/bookmarklet/dom.js';

import cats from '../mock/menu-data.json';
const FAST = 0.01;

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
    const rec = startRecording();
    // 模擬使用者手動點一次
    const card = [...document.querySelectorAll('[data-testid^="menuItems-item"]')].find((c) => c.textContent.includes('創意自選波奇'));
    card.click();
    const pick = (group, opt) => {
      const g = [...document.querySelectorAll('.attribute-category-title')].find((t) => t.textContent === group).parentElement.parentElement;
      const row = [...g.querySelectorAll('.px-3')].find((r) => r.querySelector('.attribute-option-title').textContent === opt);
      (row.querySelector('input') || row.querySelector('[data-testid^=quantityCounter-plus]')).click();
    };
    for (const [g, list] of Object.entries(myPoke.options)) for (const o of list) pick(g, o);
    document.querySelector('[data-testid^=attributeQuantityEditor-add]').click();
    const ta = document.querySelector('textarea[data-testid=comment]');
    ta.value = '醬少一點';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-testid=attributeCTALayout]').click();
    expect(shop.cart).toHaveLength(1);
    rec.stop();
    expect(rec.list).toHaveLength(1);
    const r = rec.list[0];
    expect(r).toMatchObject({ item: '創意自選波奇', qty: 2, comment: '醬少一點', price: 125 });
    expect(r.options['加點蛋白質']).toEqual(['挪威鮭魚(生)', '挪威鮭魚(生)']);
    expect(r.optPrices['加點蛋白質']['挪威鮭魚(生)']).toBe(65);
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

  it('讀得懂 seed 舊版 localStorage 格式', () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: '2026-01-01T00:00:00Z', items: [{ item: '麥茶', qty: 1, options: {} }] }));
    expect(loadLocalSets()[0].items[0].item).toBe('麥茶');
  });
});
