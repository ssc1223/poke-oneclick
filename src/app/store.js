// PWA 的本機資料（localStorage）＋本次分頁的訂餐頁（sessionStorage）
import { normalizeSet, newId, FORMAT_VERSION } from '../shared/codec.js';
import { normalizeOrderPageUrl, readReturnUrl } from '../shared/order-url.js';

export const STORE_KEY = 'pokeOneClick.app.v1';
/** 本次從書籤帶進來的有效訂餐頁（同分頁有效；不寫進分享資料） */
export const SESSION_ORDER_KEY = 'pokeOneClick.sessionOrderUrl';

const empty = () => ({ v: FORMAT_VERSION, sets: [], settings: { orderUrl: '', theme: 'auto' } });

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return empty();
    const sets = [];
    for (const s of Array.isArray(raw.sets) ? raw.sets : []) {
      try { sets.push(normalizeSet(s)); } catch { /* 跳過壞掉的 */ }
    }
    return { v: FORMAT_VERSION, sets, settings: { ...empty().settings, ...(raw.settings || {}) } };
  } catch {
    return empty();
  }
}

export function save(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function getSessionOrderUrl() {
  try {
    return sessionStorage.getItem(SESSION_ORDER_KEY) || '';
  } catch {
    return '';
  }
}

export function setSessionOrderUrl(url) {
  try {
    if (url) sessionStorage.setItem(SESSION_ORDER_KEY, url);
    else sessionStorage.removeItem(SESSION_ORDER_KEY);
  } catch { /* 私人模式等可能失敗 */ }
}

/**
 * 點餐要用的網址：優先本次書籤帶來的有效桌次，其次設定裡存的。
 * （手機 Brave 從書籤進 App 會離開點餐頁，不能依賴已卸載頁面的記憶體。）
 */
export function resolveOrderUrl(settings) {
  const session = getSessionOrderUrl();
  if (isValidOrderUrl(session)) return session;
  const saved = settings && settings.orderUrl;
  return isValidOrderUrl(saved) ? saved : '';
}

/**
 * 處理 App 網址的 #return=…：寫入 session，並回傳要合併進 settings 的 orderUrl。
 * 不合法則 applied=false（不寫入）。
 */
export function applyIncomingReturnUrl(hash, settings = {}) {
  const raw = readReturnUrl(hash);
  if (!raw) return { applied: false, orderUrl: settings.orderUrl || '' };
  let url;
  try {
    url = normalizeOrderPageUrl(raw);
  } catch {
    return { applied: false, orderUrl: settings.orderUrl || '' };
  }
  if (!isValidOrderUrl(url)) return { applied: false, orderUrl: settings.orderUrl || '' };
  setSessionOrderUrl(url);
  return { applied: true, orderUrl: url };
}

/** 匯入組合：id 重複且內容相同就略過；內容不同就當成新的一組 */
export function importSets(state, sets) {
  let added = 0;
  for (const s of sets) {
    const same = state.sets.find((x) => x.id === s.id);
    if (same && JSON.stringify(same.items) === JSON.stringify(s.items) && same.name === s.name) continue;
    state.sets.unshift({ ...s, id: same ? newId() : s.id });
    added++;
  }
  save(state);
  return added;
}

export function isValidOrderUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && /(^|\.)cashier\.tw$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** 產生去點餐的網址：保留原本網址，把 hash 換成 #coc=<資料> */
export function buildOrderUrl(orderUrl, token) {
  const u = new URL(orderUrl);
  u.hash = 'coc=' + token;
  return u.toString();
}
