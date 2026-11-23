// PWA 的本機資料（localStorage）
import { normalizeSet, newId, FORMAT_VERSION } from '../shared/codec.js';

export const STORE_KEY = 'pokeOneClick.app.v1';

const empty = () => ({ v: FORMAT_VERSION, sets: [], settings: { theme: 'auto' } });

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return empty();
    const sets = [];
    for (const s of Array.isArray(raw.sets) ? raw.sets : []) {
      try { sets.push(normalizeSet(s)); } catch { /* 跳過壞掉的 */ }
    }
    const settings = { ...empty().settings, ...(raw.settings || {}) };
    // 舊版會長期記住點餐網址；電小二每次掃 QR code 都是新的訂單網址，
    // 舊網址會連到已結束的訂單而出錯，所以不再保存
    delete settings.orderUrl;
    return { v: FORMAT_VERSION, sets, settings };
  } catch {
    return empty();
  }
}

export function save(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
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

// ---------- 這次的點餐網址（由書籤帶過來，只短暫保存） ----------
export const ORDER_KEY = 'pokeOneClick.currentOrder';
export const ORDER_TTL = 3 * 60 * 60 * 1000; // 3 小時：一餐的時間就夠了

/** 記住這次掃 QR code 開到的點餐網址（去掉 hash） */
export function setCurrentOrderUrl(url, now = Date.now()) {
  if (!isValidOrderUrl(url)) return false;
  const u = new URL(url);
  u.hash = '';
  localStorage.setItem(ORDER_KEY, JSON.stringify({ url: u.toString(), at: now }));
  return true;
}

/** 取得這次的點餐網址；過期或不合法就清掉並回傳空字串 */
export function getCurrentOrderUrl(now = Date.now()) {
  try {
    const o = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
    if (o && isValidOrderUrl(o.url) && now - o.at >= 0 && now - o.at < ORDER_TTL) return o.url;
  } catch { /* 忽略 */ }
  localStorage.removeItem(ORDER_KEY);
  return '';
}

export function clearCurrentOrderUrl() {
  localStorage.removeItem(ORDER_KEY);
}

/** 產生去點餐的網址：保留原本網址，把 hash 換成 #coc=<資料> */
export function buildOrderUrl(orderUrl, token) {
  const u = new URL(orderUrl);
  u.hash = 'coc=' + token;
  return u.toString();
}
