import { describe, it, expect } from 'vitest';
import {
  utf8ToB64url, b64urlToUtf8, encodeSets, decodeInput, tryDecode, CodecError, FORMAT_VERSION, normalizeItem,
} from '../src/shared/codec.js';

const sets = [
  {
    id: 'a1', name: '小明的鮮魚波奇', savedAt: '2026-11-01T10:00:00.000Z',
    items: [
      { item: '創意自選波奇', qty: 1, comment: '醬少一點 🙏', options: { 基底選一: ['糙米'], 加點蛋白質: ['挪威鮭魚(生)', '挪威鮭魚(生)'] }, price: 125, optPrices: { 加點蛋白質: { '挪威鮭魚(生)': 65 } } },
      { item: '麥茶', qty: 2, comment: '', options: {} },
    ],
  },
  { id: 'b2', name: '小美', savedAt: '2026-11-02T10:00:00.000Z', items: [{ item: '味噌湯', qty: 1, comment: '', options: {} }] },
];

describe('base64url', () => {
  it('中文、emoji 來回編碼一致，且只含網址安全字元', () => {
    const s = '波奇波奇【高雄博愛店】🥗 + / = ?';
    const enc = utf8ToB64url(s);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(b64urlToUtf8(enc)).toBe(s);
  });
  it('可容忍斷行、空白與補齊的 =', () => {
    const enc = utf8ToB64url('鮭魚');
    expect(b64urlToUtf8(enc.slice(0, 2) + '\n ' + enc.slice(2) + '==')).toBe('鮭魚');
  });
  it('非法字元或錯誤長度丟 CodecError', () => {
    expect(() => b64urlToUtf8('abc$%')).toThrow(CodecError);
    expect(() => b64urlToUtf8('a')).toThrow(CodecError);
    expect(() => b64urlToUtf8('')).toThrow(CodecError);
  });
  it('不是合法 UTF-8 的位元組丟 CodecError', () => {
    expect(() => b64urlToUtf8('_w')).toThrow(/文字編碼/); // 0xFF
  });
});

describe('encodeSets / decodeInput', () => {
  it('多組、多份餐點來回一致，含版本欄位', () => {
    const token = encodeSets(sets);
    const payload = JSON.parse(b64urlToUtf8(token));
    expect(payload.v).toBe(FORMAT_VERSION);
    expect(payload.app).toBe('poke-oneclick');
    const back = decodeInput(token);
    expect(back.sets).toHaveLength(2);
    expect(back.sets[0]).toEqual(sets[0]);
    expect(back.sets[0].items[0].options.加點蛋白質).toEqual(['挪威鮭魚(生)', '挪威鮭魚(生)']);
  });
  it('可從完整網址的 #import= 或 #coc= 取出資料', () => {
    const token = encodeSets(sets);
    expect(decodeInput(`https://example.github.io/poke-oneclick/#import=${token}`).sets).toHaveLength(2);
    expect(decodeInput(`https://shop.cashier.tw/online/menu/order/x#foo=1&coc=${token}`).sets[1].name).toBe('小美');
    expect(decodeInput(`coc=${token}`).sets).toHaveLength(2);
  });
  it('可直接貼 JSON，也相容 seed 舊格式 {savedAt, items}', () => {
    const legacy = JSON.stringify({ savedAt: '2026-01-01T00:00:00Z', items: [{ item: '麥茶', qty: 1, options: {} }] });
    const r = decodeInput(legacy);
    expect(r.sets).toHaveLength(1);
    expect(r.sets[0].name).toBe('已存餐點');
    expect(r.sets[0].items[0].item).toBe('麥茶');
  });
  it('錯誤輸入給出中文錯誤訊息', () => {
    expect(() => decodeInput('')).toThrow('沒有資料');
    expect(() => decodeInput('   ')).toThrow(CodecError);
    expect(() => decodeInput('{not json')).toThrow(/JSON/);
    expect(() => decodeInput(utf8ToB64url('hello'))).toThrow(/JSON/);
    expect(() => decodeInput(JSON.stringify({ v: 1, sets: [] }))).toThrow(/沒有任何餐點組合/);
    expect(() => decodeInput(JSON.stringify({ v: 1, sets: [{ name: 'x', items: [] }] }))).toThrow(/沒有任何餐點/);
    expect(() => decodeInput(JSON.stringify({ v: 1, sets: [{ items: [{ qty: 1 }] }] }))).toThrow(/品項名稱/);
    expect(() => decodeInput(JSON.stringify({ v: 99, sets }))).toThrow(/版本/);
    expect(() => decodeInput('null')).toThrow(CodecError);
    expect(tryDecode('亂碼!!')).toBeNull();
  });
  it('正規化：數量夾在 1~99、過濾非字串選項、缺 id 會補上', () => {
    const it = normalizeItem({ item: ' 麥茶 ', qty: 500, options: { a: ['x', 3, null, ' y '], b: 'z' }, price: 'NaN' });
    expect(it).toEqual({ item: '麥茶', qty: 99, comment: '', options: { a: ['x', 'y'], b: ['z'] } });
    expect(normalizeItem({ item: 'a', qty: -1 }).qty).toBe(1);
    const r = decodeInput(JSON.stringify({ v: 1, sets: [{ items: [{ item: 'a' }] }] }));
    expect(r.sets[0].id).toMatch(/^[\w-]+$/);
    expect(r.sets[0].name).toBe('餐點組合 1');
  });
});
