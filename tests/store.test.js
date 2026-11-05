// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { load, importSets, isValidOrderUrl, buildOrderUrl, STORE_KEY } from '../src/app/store.js';
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
