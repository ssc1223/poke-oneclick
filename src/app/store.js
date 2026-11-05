// PWA 的本機資料（localStorage）
import { normalizeSet, newId, FORMAT_VERSION } from '../shared/codec.js';

export const STORE_KEY = 'pokeOneClick.app.v1';

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
