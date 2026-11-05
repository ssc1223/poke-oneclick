// 「存餐點」核心：攔截「加入購物車」時記下目前選項視窗的內容
import { norm, groups, rows, rowState, cardName, parsePrice, parseAddOn, KEY } from './dom.js';
import { normalizePayload, normalizeSet, newId } from '../shared/codec.js';

/** 讀取目前打開的選項視窗，產生一份餐點紀錄 */
export function snapshotItem(lastItem) {
  const title = norm((document.querySelector('.modal.show .modal-title, .modal.show h5, .modal.show .modal-header') || {}).textContent);
  const options = {};
  const optPrices = {};
  groups().forEach((g) => {
    const sel = [];
    rows(g.el).forEach((r) => {
      const n = rowState(r.el).n;
      for (let k = 0; k < n; k++) sel.push(r.title);
      if (n) {
        const p = parseAddOn(r.el.textContent.replace(r.title, ''));
        (optPrices[g.title] = optPrices[g.title] || {})[r.title] = p;
      }
    });
    options[g.title] = sel;
  });
  const q = document.querySelector('[data-testid^="attributeQuantityEditor-edit"]');
  const c = document.querySelector('textarea[data-testid=comment]');
  const rec = {
    item: (lastItem && lastItem.name) || title,
    qty: q ? parseInt(q.textContent, 10) || 1 : 1,
    comment: c ? c.value : '',
    options,
  };
  if (lastItem && typeof lastItem.price === 'number') rec.price = lastItem.price;
  if (Object.keys(optPrices).length) rec.optPrices = optPrices;
  return rec;
}

/**
 * 開始記錄：回傳 { list, stop }。onAdd(rec, list) 每記住一份就會被呼叫。
 */
export function startRecording(onAdd) {
  const list = [];
  let last = null;
  const handler = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const m = t.closest('[data-testid^="menuItems-item"]');
    if (m) last = { name: cardName(m), price: parsePrice(m.textContent.replace(cardName(m), '')) };
    const b = t.closest('[data-testid=attributeCTALayout]');
    if (b && /加入購物車/.test(b.textContent)) {
      const rec = snapshotItem(last);
      if (rec.item) {
        list.push(rec);
        onAdd && onAdd(rec, list);
      }
    }
  };
  document.addEventListener('click', handler, true);
  return { list, stop: () => document.removeEventListener('click', handler, true) };
}

/** 讀取本站 localStorage 中的組合（相容 seed 舊格式） */
export function loadLocalSets() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalizePayload(JSON.parse(raw)).sets;
  } catch {
    return [];
  }
}

/** 存成新的一組（最多保留 20 組，新的在前） */
export function saveLocalSet(name, items) {
  const set = normalizeSet({ id: newId(), name, savedAt: new Date().toISOString(), items });
  const sets = [set, ...loadLocalSets()].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify({ v: 1, app: 'poke-oneclick', sets }));
  return set;
}
