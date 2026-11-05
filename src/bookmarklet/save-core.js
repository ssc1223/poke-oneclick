// 「存餐點」核心：攔截「加入購物車」，等網站真的把選項視窗關掉（＝成功加入）才記下
import { norm, groups, rows, rowState, cardName, cardPrice, rowAddOn, numOf, qsModal, activeModal, visible, KEY } from './dom.js';
import { normalizePayload, normalizeSet, newId } from '../shared/codec.js';

/** 讀取目前打開的選項視窗，產生一份餐點紀錄 */
export function snapshotItem(lastItem) {
  const title = norm((qsModal('.modal-title, h5, .modal-header') || {}).textContent);
  const options = {};
  const optPrices = {};
  groups().forEach((g) => {
    const sel = [];
    rows(g.el).forEach((r) => {
      const n = rowState(r.el).n;
      for (let k = 0; k < n; k++) sel.push(r.title);
      if (n) (optPrices[g.title] = optPrices[g.title] || {})[r.title] = rowAddOn(r.el);
    });
    options[g.title] = sel;
  });
  const q = qsModal('[data-testid^="attributeQuantityEditor-edit"]');
  const c = qsModal('textarea[data-testid=comment]');
  const rec = {
    item: (lastItem && lastItem.name) || title,
    qty: numOf(q) || 1,
    comment: c ? c.value : '',
    options,
  };
  if (lastItem && typeof lastItem.price === 'number') rec.price = lastItem.price;
  if (Object.keys(optPrices).length) rec.optPrices = optPrices;
  return rec;
}

/**
 * 開始記錄：回傳 { list, stop }。
 * onAdd(rec, list)：網站確實加入購物車（選項視窗關閉）後呼叫。
 * opts.onReject(rec)：按了「加入購物車」但視窗一直沒關（例如必選項沒選完）時呼叫，這份不會被記下。
 * opts.timeout / opts.interval：等待視窗關閉的時間（毫秒）。
 */
export function startRecording(onAdd, { onReject, timeout = 4000, interval = 100 } = {}) {
  const list = [];
  let last = null;
  let pending = null; // 同時只等一份；再按一次就以新的那次為準

  const cancelPending = () => { if (pending) { clearTimeout(pending.timer); pending = null; } };

  const handler = (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const m = t.closest('[data-testid^="menuItems-item"]');
    if (m) last = { name: cardName(m), price: cardPrice(m) };
    const b = t.closest('[data-testid=attributeCTALayout]');
    if (!b || !/加入購物車/.test(b.textContent) || !visible(b)) return;
    const modal = activeModal();
    if (modal && !modal.contains(b)) return; // 不是目前視窗裡的按鈕
    // capture 階段先拍下內容（網站處理完點擊後會清掉視窗），但要等確認成功才記入
    const rec = snapshotItem(last);
    if (!rec.item) return;
    cancelPending();
    const job = { rec, start: Date.now() };
    const isClosed = () => !b.isConnected || !visible(b) || (modal && !modal.classList.contains('show'));
    const check = () => {
      if (pending !== job) return;
      if (isClosed()) {
        pending = null;
        list.push(rec);
        onAdd && onAdd(rec, list);
      } else if (Date.now() - job.start >= timeout) {
        pending = null;
        onReject && onReject(rec);
      } else {
        job.timer = setTimeout(check, interval);
      }
    };
    pending = job;
    job.timer = setTimeout(check, interval);
  };
  document.addEventListener('click', handler, true);
  return { list, stop: () => { cancelPending(); document.removeEventListener('click', handler, true); } };
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
