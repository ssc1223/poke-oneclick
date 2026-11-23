// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { load, importSets, isValidOrderUrl, buildOrderUrl, STORE_KEY, setCurrentOrderUrl, getCurrentOrderUrl, ORDER_TTL } from '../src/app/store.js';
import { decodeInput } from '../src/shared/codec.js';

beforeEach(() => localStorage.clear());

describe('PWA 本機資料', () => {
  it('空資料／壞資料回到預設值', () => {
    expect(load().sets).toEqual([]);
    localStorage.setItem(STORE_KEY, '{壞掉');
    expect(load().settings.theme).toBe('auto');
  });
  it('匯入：重複不重加、內容不同另存一組', () => {
    const st = load();
    const set = { id: 'x1', name: 'A', savedAt: '2026-01-01T00:00:00.000Z', items: [{ item: '麥茶', qty: 1, comment: '', options: {} }] };
    expect(importSets(st, [set])).toBe(1);
    expect(importSets(st, [set])).toBe(0);
    expect(importSets(st, [{ ...set, name: 'B' }])).toBe(1);
    expect(load().sets.map((s) => s.name)).toEqual(['B', 'A']);
    expect(new Set(load().sets.map((s) => s.id)).size).toBe(2);
  });
  it('不再使用舊版長期保存的點餐網址（每次掃 QR code 網址都不同）', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ sets: [], settings: { orderUrl: 'https://shop.cashier.tw/online/menu/order/OLD', theme: 'dark' } }));
    const st = load();
    expect(st.settings.orderUrl).toBeUndefined();
    expect(st.settings.theme).toBe('dark');
    expect(getCurrentOrderUrl()).toBe('');
  });
  it('這次的點餐網址：去掉 hash、只接受電小二網址、3 小時後過期', () => {
    const t = 1_000_000;
    expect(setCurrentOrderUrl('https://evil.example.com/x', t)).toBe(false);
    expect(setCurrentOrderUrl('https://shop.cashier.tw/online/menu/order/A#coc=x', t)).toBe(true);
    expect(getCurrentOrderUrl(t + 1000)).toBe('https://shop.cashier.tw/online/menu/order/A');
    setCurrentOrderUrl('https://shop.cashier.tw/online/menu/order/B', t + 2000); // 新掃的覆蓋舊的
    expect(getCurrentOrderUrl(t + 3000)).toBe('https://shop.cashier.tw/online/menu/order/B');
    expect(getCurrentOrderUrl(t + 2000 + ORDER_TTL)).toBe('');
    expect(getCurrentOrderUrl(t + 3000)).toBe(''); // 過期就清掉
  });
  it('點餐網址驗證與 #coc= 組合', () => {
    expect(isValidOrderUrl('https://shop.cashier.tw/online/menu/order/abc')).toBe(true);
    expect(isValidOrderUrl('http://shop.cashier.tw/x')).toBe(false);
    expect(isValidOrderUrl('https://evil.example.com/cashier.tw')).toBe(false);
    expect(isValidOrderUrl('不是網址')).toBe(false);
    const url = buildOrderUrl('https://shop.cashier.tw/online/menu/order/abc#old', 'TOKEN');
    expect(url).toBe('https://shop.cashier.tw/online/menu/order/abc#coc=TOKEN');
    expect(() => decodeInput(url)).toThrow(); // TOKEN 不是有效資料
  });
});
