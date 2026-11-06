// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeOrderPageUrl, buildAppSelectUrl, readReturnUrl,
} from '../src/shared/order-url.js';
import {
  resolveOrderUrl, applyIncomingReturnUrl, setSessionOrderUrl, getSessionOrderUrl,
  SESSION_ORDER_KEY, STORE_KEY, save, load, buildOrderUrl, isValidOrderUrl,
} from '../src/app/store.js';
import { encodeSets } from '../src/shared/codec.js';

// 測試用假單號（非真實訂單）
const CURRENT = 'https://shop.cashier.tw/online/menu/order/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OLD = 'https://shop.cashier.tw/online/menu/order/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PWA = 'https://example.test/poke-oneclick/';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('訂餐頁 return URL', () => {
  it('normalizeOrderPageUrl 去掉 #coc= 與其他 hash', () => {
    expect(normalizeOrderPageUrl(`${CURRENT}#coc=abc`)).toBe(CURRENT);
    expect(normalizeOrderPageUrl(`${CURRENT}#/x`)).toBe(CURRENT);
  });

  it('buildAppSelectUrl 帶上目前訂餐頁；readReturnUrl 可還原', () => {
    const link = buildAppSelectUrl(PWA, `${CURRENT}#coc=should-strip`);
    expect(link.startsWith(PWA + '#return=')).toBe(true);
    expect(link).not.toContain(OLD);
    const parsed = readReturnUrl(new URL(link).hash);
    expect(parsed).toBe(CURRENT);
  });

  it('拒絕非 cashier.tw 的 return', () => {
    const evil = applyIncomingReturnUrl(
      `#return=${encodeURIComponent('https://evil.example/order/x')}`,
      { orderUrl: OLD },
    );
    expect(evil.applied).toBe(false);
    expect(getSessionOrderUrl()).toBe('');
  });
});

describe('當前 URL 與舊儲存 URL 不同時', () => {
  it('resolveOrderUrl 優先用 session（書籤帶來的這一桌），不用舊 settings', () => {
    setSessionOrderUrl(CURRENT);
    expect(resolveOrderUrl({ orderUrl: OLD })).toBe(CURRENT);
    expect(resolveOrderUrl({ orderUrl: OLD })).not.toBe(OLD);
  });

  it('applyIncomingReturnUrl 寫入 session 並更新要存的 orderUrl', () => {
    const hash = `#return=${encodeURIComponent(CURRENT)}`;
    const r = applyIncomingReturnUrl(hash, { orderUrl: OLD });
    expect(r.applied).toBe(true);
    expect(r.orderUrl).toBe(CURRENT);
    expect(getSessionOrderUrl()).toBe(CURRENT);
    expect(sessionStorage.getItem(SESSION_ORDER_KEY)).toBe(CURRENT);
  });

  it('點餐用的 #coc= 網址建立在「目前」桌次上，不是舊單號', () => {
    setSessionOrderUrl(CURRENT);
    const orderUrl = resolveOrderUrl({ orderUrl: OLD });
    const token = encodeSets([{ id: 't', name: '測', savedAt: '2026-01-01T00:00:00.000Z', items: [{ item: '麥茶', qty: 1, comment: '', options: {} }] }]);
    const go = buildOrderUrl(orderUrl, token);
    expect(go.startsWith(CURRENT + '#coc=')).toBe(true);
    expect(go.includes('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(false);
    expect(isValidOrderUrl(orderUrl)).toBe(true);
  });

  it('沒有 session 時才退回 settings.orderUrl', () => {
    expect(resolveOrderUrl({ orderUrl: OLD })).toBe(OLD);
    expect(resolveOrderUrl({ orderUrl: '' })).toBe('');
  });

  it('永久設定仍可儲存，但分享／load 不會帶出 session', () => {
    setSessionOrderUrl(CURRENT);
    save({ v: 1, sets: [], settings: { orderUrl: OLD, theme: 'auto' } });
    const st = load();
    expect(st.settings.orderUrl).toBe(OLD);
    expect(JSON.parse(localStorage.getItem(STORE_KEY)).settings.orderUrl).toBe(OLD);
    // session 仍在，resolve 仍優先目前桌
    expect(resolveOrderUrl(st.settings)).toBe(CURRENT);
  });
});
