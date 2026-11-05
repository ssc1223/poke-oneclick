// 電小二頁面 DOM 操作（沿用 seed/src/common.js 已用 Playwright 驗證過的選擇器與做法）
import { normName as norm } from '../shared/compare.js';

export { norm };
export const KEY = 'cashierOneClick.v1';

export const SOLD_OUT_RE = /已售完|售完|完售|售罄|賣完/;

export const groups = () => {
  const out = [];
  document.querySelectorAll('.attribute-category-title').forEach((t) => {
    const g = t.parentElement.parentElement;
    out.push({ title: norm(t.textContent), el: g });
  });
  return out;
};

export const rows = (g) => {
  const out = [];
  g.querySelectorAll('.attribute-option-title').forEach((t) => {
    const r = t.closest('.px-3') || t.parentElement.parentElement.parentElement;
    out.push({ title: norm(t.textContent), el: r });
  });
  return out;
};

export const rowState = (r) => {
  const i = r.querySelector('input[type=radio],input[type=checkbox]');
  if (i) return { input: i, n: i.checked ? 1 : 0 };
  const e = r.querySelector('[data-testid^="quantityCounter-edit"]');
  return {
    n: e ? parseInt(e.textContent, 10) || 0 : 0,
    plus: r.querySelector('[data-testid^="quantityCounter-plus"]'),
    minus: () => r.querySelector('[data-testid^="quantityCounter-minus"]'),
  };
};

export const tap = (el) => {
  if (!el) return;
  if (el.click && !(el instanceof SVGElement)) el.click();
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

export const visible = (el) => !!(el && el.offsetParent);

/** 從「$189」「NT$1,200」之類文字抓出價格 */
export const parsePrice = (text) => {
  const m = String(text || '').match(/\$\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : undefined;
};

/** 選項列的加價：「+45」「+$45」「(+45)」 */
export const parseAddOn = (text) => {
  const m = String(text || '').match(/\+\s*\$?\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
};

export const cards = () => [].slice.call(document.querySelectorAll('[data-testid^="menuItems-item"]'));

export const cardName = (m) => {
  const t = m.querySelector('div[style*="web-text-md"]');
  return norm(t ? t.textContent : m.textContent.split('$')[0]);
};

export const findCard = (name) => cards().find((m) => {
  const t = m.querySelector('div[style*="web-text-md"]');
  return t && norm(t.textContent) === norm(name);
});

const isDisabled = (el) => !!(el && (el.disabled || el.getAttribute('aria-disabled') === 'true' || (typeof el.className === 'string' && /\bdisabled\b/.test(el.className))));

/** 讀取目前頁面上的菜單（品項名稱、價格、是否售完） */
export function snapshotMenu() {
  const seen = new Set();
  const out = [];
  cards().forEach((m) => {
    const name = cardName(m);
    if (!name || seen.has(name)) return;
    seen.add(name);
    const rest = m.textContent.replace(name, '');
    out.push({ name, price: parsePrice(rest), soldOut: SOLD_OUT_RE.test(rest) || isDisabled(m) });
  });
  return out;
}

/** 讀取已打開的選項視窗中的群組與選項 */
export function snapshotGroups() {
  return groups().map((g) => ({
    title: g.title,
    el: g.el,
    options: rows(g.el).map((r) => {
      const rest = r.el.textContent.replace(r.title, '');
      const input = r.el.querySelector('input');
      const soldOut = SOLD_OUT_RE.test(rest) || !!(input && input.disabled && !input.checked);
      return { name: r.title, price: parseAddOn(rest), soldOut, el: r.el };
    }),
  }));
}

export const ackButton = () => [].slice.call(document.querySelectorAll('button')).find((b) => /我知道了/.test(b.textContent) && b.offsetParent);
export const cta = () => document.querySelector('[data-testid=attributeCTALayout]');

export const setTextareaValue = (c, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  set.call(c, v);
  c.dispatchEvent(new Event('input', { bubbles: true }));
};
