import { describe, it, expect } from 'vitest';
import {
  similarity, suggest, compareItems, compareOptions, resolveItems, resolveOptions, describeIssue, simKey,
} from '../src/shared/compare.js';

const menu = [
  { name: '夏威夷經典鮪魚飯', price: 189 },
  { name: '加州辣鮪魚飯', price: 179 },
  { name: '招牌奶香芥末鮭魚飯', price: 239 },
  { name: '創意自選波奇', price: 125 },
  { name: '冰麥茶', price: 20 },
  { name: '輕柚冰茶', price: 35, soldOut: true },
  { name: '檸檬汁', price: 35 },
];

describe('相似度', () => {
  it('相同名稱（忽略空白、全形）為 1', () => {
    expect(similarity('白米                糙米', '白米 糙米')).toBe(1);
    expect(similarity('鮪魚（生）', '鮪魚(生)')).toBe(1);
    expect(simKey('酪梨泥(+45)')).toBe('酪梨泥');
  });
  it('改名後仍高度相似，無關名稱低分', () => {
    expect(similarity('麥茶', '冰麥茶')).toBeGreaterThanOrEqual(0.6);
    expect(similarity('招牌奶香芥末鮭魚飯', '奶香芥末鮭魚飯')).toBeGreaterThan(0.7);
    expect(similarity('麥茶', '加州辣鮪魚飯')).toBeLessThan(0.2);
  });
  it('suggest 依分數排序並排除自己', () => {
    const s = suggest('鮪魚飯', menu.map((m) => m.name));
    expect(s[0].name).toMatch(/鮪魚飯/);
    expect(s.every((x, i, a) => i === 0 || a[i - 1].score >= x.score)).toBe(true);
    expect(suggest('麥茶', ['麥茶'])).toEqual([]);
  });
});

describe('compareItems', () => {
  it('完全一致 → 沒有問題', () => {
    expect(compareItems([{ item: '創意自選波奇', price: 125 }, { item: '檸檬汁' }], menu)).toEqual([]);
  });
  it('改名 → item-renamed 並建議新名稱', () => {
    const [is] = compareItems([{ item: '麥茶' }], menu);
    expect(is.kind).toBe('item-renamed');
    expect(is.suggestions[0].name).toBe('冰麥茶');
    expect(describeIssue(is)).toContain('冰麥茶');
  });
  it('下架（沒有相近名稱）→ item-missing', () => {
    const [is] = compareItems([{ item: '沛綠雅氣泡水' }], menu);
    expect(is.kind).toBe('item-missing');
    expect(describeIssue(is)).toContain('下架');
  });
  it('賣完 → item-soldout，建議不含售完品項', () => {
    const [is] = compareItems([{ item: '輕柚冰茶' }], menu);
    expect(is.kind).toBe('item-soldout');
    expect(is.suggestions.map((s) => s.name)).not.toContain('輕柚冰茶');
  });
  it('價格變動 → item-price（沒有記錄價格則不提示）', () => {
    const issues = compareItems([{ item: '招牌奶香芥末鮭魚飯', price: 229 }, { item: '夏威夷經典鮪魚飯' }], menu);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'item-price', from: 229, to: 239 });
    expect(describeIssue(issues[0])).toBe('「招牌奶香芥末鮭魚飯」價格變動：$229 → $239');
  });
  it('resolveItems：略過 vs. 用建議替代 vs. 手動選擇', () => {
    const items = [{ item: '麥茶', qty: 2, price: 20 }, { item: '沛綠雅氣泡水' }, { item: '招牌奶香芥末鮭魚飯', price: 229 }];
    const issues = compareItems(items, menu);
    const skip = resolveItems(items, issues, 'skip');
    expect(skip.items.map((x) => x.item)).toEqual(['招牌奶香芥末鮭魚飯']);
    expect(skip.skipped.map((x) => x.item)).toEqual(['麥茶', '沛綠雅氣泡水']);
    const rep = resolveItems(items, issues, 'replace');
    expect(rep.items[0]).toEqual({ item: '冰麥茶', qty: 2 });
    const k = issues.findIndex((x) => x.kind === 'item-renamed');
    const none = resolveItems(items, issues, 'replace', { [k]: '' });
    expect(none.items.map((x) => x.item)).not.toContain('冰麥茶');
  });
});

describe('compareOptions', () => {
  const groups = [
    { title: '基底選一', options: [{ name: '白米' }, { name: '糙米' }, { name: '萵苣', price: 10 }] },
    { title: '醬汁選一', options: [{ name: '經典波奇【全素】' }, { name: '和風柚香 【全素】', soldOut: true }, { name: '日式芝麻 【全素】' }] },
    { title: '加點蛋白質', options: [{ name: '挪威鮭魚(生)', price: 70 }, { name: '鮪魚(生)', price: 55 }] },
    { title: '配菜選六', options: [{ name: '玉米' }, { name: '洋蔥' }, { name: '小黃瓜' }] },
  ];
  it('全部存在 → 沒有問題', () => {
    expect(compareOptions({ item: 'x', options: { 基底選一: ['糙米'], 空群組: [] } }, groups)).toEqual([]);
  });
  it('選項不見（改名）→ option-missing 並建議', () => {
    const [is] = compareOptions({ item: 'x', options: { 配菜選六: ['玉米', '黃瓜'] } }, groups);
    expect(is).toMatchObject({ kind: 'option-missing', group: '配菜選六', option: '黃瓜' });
    expect(is.suggestions[0].name).toBe('小黃瓜');
  });
  it('選項售完 → option-soldout', () => {
    const [is] = compareOptions({ item: 'x', options: { 醬汁選一: ['和風柚香                【全素】'] } }, groups);
    expect(is.kind).toBe('option-soldout');
    expect(is.suggestions.map((s) => s.name)).not.toContain('和風柚香 【全素】');
  });
  it('加價變動 → option-price', () => {
    const issues = compareOptions({ item: 'x', options: { 加點蛋白質: ['挪威鮭魚(生)', '挪威鮭魚(生)', '鮪魚(生)'] }, optPrices: { 加點蛋白質: { '挪威鮭魚(生)': 65, '鮪魚(生)': 55 } } }, groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'option-price', from: 65, to: 70 });
  });
  it('群組改名 → group-missing，並在建議群組內繼續比對選項', () => {
    const issues = compareOptions({ item: 'x', options: { 基底選一份: ['糙米', '紫米'] } }, groups);
    expect(issues[0]).toMatchObject({ kind: 'group-missing', group: '基底選一份' });
    expect(issues[0].suggestions[0].name).toBe('基底選一');
    expect(issues[1]).toMatchObject({ kind: 'option-missing', option: '紫米', targetGroup: '基底選一' });
  });
  it('群組完全不見（無相近群組）', () => {
    const issues = compareOptions({ item: 'x', options: { 餐具選項: ['不需要餐具'] } }, groups);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('group-missing');
  });
  it('resolveOptions：替代、略過、群組搬移', () => {
    const item = { item: 'x', options: { 配菜選六: ['玉米', '黃瓜'], 基底選一份: ['糙米'] } };
    const issues = compareOptions(item, groups);
    const rep = resolveOptions(item, issues, 'replace');
    expect(rep.options).toEqual({ 配菜選六: ['玉米', '小黃瓜'], 基底選一: ['糙米'] });
    const skip = resolveOptions(item, issues, 'skip');
    expect(skip.options).toEqual({ 配菜選六: ['玉米'] });
    expect(item.options.配菜選六).toEqual(['玉米', '黃瓜']); // 不修改原物件
  });
});
