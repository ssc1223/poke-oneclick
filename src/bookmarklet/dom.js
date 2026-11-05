// 電小二頁面 DOM 操作（沿用 seed/src/common.js 已用 Playwright 驗證過的選擇器與做法）
import { normName as norm } from '../shared/compare.js';

export { norm };
export const KEY = 'cashierOneClick.v1';

export const SOLD_OUT_RE = /已售完|售完|完售|售罄|賣完/;

export const visible = (el) => !!(el && el.offsetParent);
// .modal 本身是 position:fixed，offsetParent 永遠是 null，所以另外看 getClientRects
const shown = (el) => visible(el) || !!(el && el.getClientRects && el.getClientRects().length);

const CTA_SEL = '[data-testid=attributeCTALayout]';

/**
 * 目前顯示中的選項視窗。電小二頁面上同時有很多 .modal，
 * 只有 .modal.show 是目前打開的那個；有多個時優先選看得見且含「加入購物車」的。
 */
export const activeModal = () => {
  const ms = [].slice.call(document.querySelectorAll('.modal.show'));
  return ms.find((m) => [].slice.call(m.querySelectorAll(CTA_SEL)).some(visible))
    || ms.find(shown)
    || null;
};

/** 在目前視窗範圍內找元素；沒有 .modal.show 時退回整頁但只取看得見的 */
export const qsModal = (sel) => {
  const m = activeModal();
  if (m) return m.querySelector(sel);
  return [].slice.call(document.querySelectorAll(sel)).find(visible) || null;
};
const qsaModal = (sel) => {
  const m = activeModal();
  if (m) return [].slice.call(m.querySelectorAll(sel));
  return [].slice.call(document.querySelectorAll(sel)).filter(visible);
};

/** 讀數字：<span>3</span> 或 <input type=number value=3> 都可以 */
export const numOf = (el) => {
  if (!el) return 0;
  const v = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : el.textContent;
  return parseInt(v, 10) || 0;
};

export const groups = () => qsaModal('.attribute-category-title').map((t) => ({
  title: norm(t.textContent),
  el: t.parentElement.parentElement,
}));

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
    n: numOf(e),
    plus: r.querySelector('[data-testid^="quantityCounter-plus"]'),
    minus: () => r.querySelector('[data-testid^="quantityCounter-minus"]'),
  };
};

export const tap = (el) => {
  if (!el) return;
  if (el.click && !(el instanceof SVGElement)) el.click();
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

/** 從「$189」「NT$1,200」之類文字抓出價格 */
export const parsePrice = (text) => {
  const m = String(text || '').match(/\$\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : undefined;
};

const KCAL_RE = /[\d.,]+\s*(?:大卡|kcal)/gi;

/**
 * 選項列的加價：真實網站是獨立的「$65」，mock／舊版是「+45」「+$45」「(+45)」。
 * 會先去掉「3.7 大卡」之類的熱量數字。
 */
export const parseAddOn = (text) => {
  const t = String(text || '').replace(KCAL_RE, ' ');
  const m = t.match(/\+\s*\$?\s*([\d,]+)/) || t.match(/\$\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
};

/** 元素底下所有「沒有子元素」的節點文字（略過 skip 選到的元素及其內容） */
const leafTexts = (root, skip) => {
  const out = [];
  const walk = (el) => {
    if (skip && el !== root && el.matches && el.matches(skip)) return;
    if (!el.children.length) {
      const t = el.textContent.trim();
      if (t) out.push(t);
      return;
    }
    // 直接夾在元素之間的文字節點也收進來
    el.childNodes.forEach((n) => {
      if (n.nodeType === 1) walk(n);
      else if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent.trim());
    });
  };
  walk(root);
  return out;
};

const PRICE_ONLY = /^(?:NT)?\$\s*[\d,]+$/;
const ADDON_ONLY = /^\(?\s*(?:\+\s*\$?|\$)\s*[\d,]+\s*\)?$/;
const NAME_SEL = 'div[style*="web-text-md"]';

/**
 * 品項卡片的價格：讀卡片裡「只含 $數字」的那個元素（真實網站是 div.fw-bold），
 * 不用整張卡片的 textContent，否則「$20」「3.7 大卡」會黏成「$203.7 大卡」。
 */
export const cardPrice = (m) => {
  const bold = [].slice.call(m.querySelectorAll('.fw-bold, .fw-bolder')).find((e) => PRICE_ONLY.test(e.textContent.trim()));
  if (bold) return parsePrice(bold.textContent);
  const leaves = leafTexts(m, NAME_SEL);
  const only = leaves.find((t) => PRICE_ONLY.test(t));
  return parsePrice(only || leaves.filter((t) => !/大卡|kcal/i.test(t)).join('\n'));
};

const ROW_SKIP = '.attribute-option-title, input, button, [data-testid^="quantityCounter"]';

/** 選項列的加價：讀列中「只含 $65 / +$45」的元素，忽略名稱、數量、熱量 */
export const rowAddOn = (rowEl) => {
  const leaves = leafTexts(rowEl, ROW_SKIP).filter((t) => !/大卡|kcal/i.test(t));
  const only = leaves.find((t) => ADDON_ONLY.test(t));
  return parseAddOn(only || leaves.join('\n'));
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
    out.push({ name, price: cardPrice(m), soldOut: SOLD_OUT_RE.test(rest) || isDisabled(m) });
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
      const input = r.el.querySelector('input[type=radio],input[type=checkbox]');
      const soldOut = SOLD_OUT_RE.test(rest) || !!(input && input.disabled && !input.checked);
      return { name: r.title, price: rowAddOn(r.el), soldOut, el: r.el };
    }),
  }));
}

export const ackButton = () => [].slice.call(document.querySelectorAll('button')).find((b) => /我知道了/.test(b.textContent) && b.offsetParent);
/** 目前視窗中看得見的「加入購物車」；頁面上可能同時有多個隱藏的 CTA */
export const cta = () => {
  const m = activeModal();
  const list = [].slice.call((m || document).querySelectorAll(CTA_SEL));
  return list.find(visible) || null;
};

/** 目前選項視窗標題（用來確認開到的是目標品項，而不是執行前殘留的視窗） */
export const modalTitle = () => {
  const m = activeModal();
  if (!m) return '';
  // 必須分開查：querySelector('a, b') 是 DOM 順序，不是選擇器順序，
  // 否則會先命中整塊 .modal-header（含關閉鈕「×」）
  const t = m.querySelector('.modal-title') || m.querySelector('.modal-header h5');
  if (t) return norm(t.textContent);
  const header = m.querySelector('.modal-header');
  if (!header) return '';
  const clone = header.cloneNode(true);
  clone.querySelectorAll('button, .btn-close, [aria-label=Close]').forEach((b) => b.remove());
  return norm(clone.textContent);
};

/** 是否還有開著的選項視窗（.modal.show） */
export const anyModalOpen = () => !!document.querySelector('.modal.show');

/**
 * 關掉目前的選項視窗：先點關閉鈕，再試 backdrop。
 * 回傳是否有發出關閉動作（不保證動畫已結束）。
 */
export function closeModal() {
  const b = document.querySelector('.modal.show .btn-close, .modal.show [aria-label=Close], .modal.show [aria-label="關閉"], .modal.show [data-testid*="close" i]');
  if (b) { tap(b); return true; }
  const bd = document.querySelector('.modal-backdrop.show, .modal-backdrop');
  if (bd) { tap(bd); return true; }
  return false;
}

export const setTextareaValue = (c, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  set.call(c, v);
  c.dispatchEvent(new Event('input', { bubbles: true }));
};
