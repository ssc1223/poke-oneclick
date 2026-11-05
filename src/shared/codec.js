// 常點組合資料格式與編碼／解碼（PWA 與書籤共用）
//
// 資料格式（version 1）：
// {
//   v: 1, app: 'poke-oneclick',
//   sets: [{
//     id, name, savedAt,
//     items: [{ item, qty, comment, options: { 群組: [選項, ...] }, price?, optPrices?: { 群組: { 選項: 加價 } } }]
//   }]
// }
// 同一個選項在陣列中出現兩次 = 數量 2。
// 傳遞時使用 base64url(UTF-8 JSON)，可放在網址 #import= / #coc= 或直接複製貼上。

export const APP = 'poke-oneclick';
export const FORMAT_VERSION = 1;

export class CodecError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CodecError';
  }
}

export function utf8ToB64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToUtf8(input) {
  let s = String(input).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!s || !/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.replace(/=+$/, '').length % 4 === 1) {
    throw new CodecError('資料格式不正確（不是有效的編碼字串）');
  }
  s = s.replace(/=+$/, '');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  let bin;
  try {
    bin = atob(s);
  } catch {
    throw new CodecError('資料格式不正確（無法解碼）');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CodecError('資料格式不正確（文字編碼錯誤）');
  }
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') throw new CodecError('餐點資料格式不正確');
  const item = str(raw.item, 100);
  if (!item) throw new CodecError('有一份餐點沒有品項名稱');
  let qty = parseInt(raw.qty, 10);
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  if (qty > 99) qty = 99;
  const options = {};
  if (raw.options && typeof raw.options === 'object' && !Array.isArray(raw.options)) {
    for (const [g, list] of Object.entries(raw.options)) {
      const key = str(g, 100);
      if (!key) continue;
      const arr = Array.isArray(list) ? list : typeof list === 'string' ? [list] : [];
      options[key] = arr.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 100)).slice(0, 50);
    }
  }
  const out = { item, qty, comment: str(raw.comment, 300), options };
  const price = num(raw.price);
  if (price !== undefined) out.price = price;
  if (raw.optPrices && typeof raw.optPrices === 'object') {
    const op = {};
    for (const [g, m] of Object.entries(raw.optPrices)) {
      if (!m || typeof m !== 'object') continue;
      const inner = {};
      for (const [o, p] of Object.entries(m)) if (num(p) !== undefined) inner[o] = p;
      if (Object.keys(inner).length) op[g] = inner;
    }
    if (Object.keys(op).length) out.optPrices = op;
  }
  return out;
}

export function normalizeSet(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new CodecError('餐點組合格式不正確');
  if (!Array.isArray(raw.items) || raw.items.length === 0) throw new CodecError('餐點組合裡沒有任何餐點');
  if (raw.items.length > 100) throw new CodecError('餐點數量太多（最多 100 份）');
  const id = typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : newId();
  const savedAt = typeof raw.savedAt === 'string' && !Number.isNaN(Date.parse(raw.savedAt)) ? raw.savedAt : new Date().toISOString();
  return {
    id,
    name: str(raw.name, 60) || `餐點組合 ${index + 1}`,
    savedAt,
    items: raw.items.map(normalizeItem),
  };
}

/** 把任何可接受的物件轉成 { v, sets }（支援 seed 舊版 {savedAt, items} 格式） */
export function normalizePayload(obj) {
  if (Array.isArray(obj)) obj = { v: FORMAT_VERSION, sets: obj };
  if (!obj || typeof obj !== 'object') throw new CodecError('資料格式不正確');
  if (!('sets' in obj) && Array.isArray(obj.items)) {
    // 舊版書籤 / 單一組合
    return { v: FORMAT_VERSION, sets: [normalizeSet({ name: obj.name || '已存餐點', ...obj }, 0)] };
  }
  if (obj.v !== undefined && (typeof obj.v !== 'number' || obj.v < 1)) throw new CodecError('資料版本不正確');
  if (typeof obj.v === 'number' && obj.v > FORMAT_VERSION) throw new CodecError('資料版本比這個工具新，請更新 App 與書籤後再試');
  if (!Array.isArray(obj.sets) || obj.sets.length === 0) throw new CodecError('資料裡沒有任何餐點組合');
  if (obj.sets.length > 50) throw new CodecError('餐點組合太多（最多 50 組）');
  return { v: FORMAT_VERSION, sets: obj.sets.map(normalizeSet) };
}

export function makePayload(sets) {
  return { v: FORMAT_VERSION, app: APP, sets };
}

export function encodeSets(sets) {
  return utf8ToB64url(JSON.stringify(makePayload(sets)));
}

/** 從網址片段、完整網址、base64url 字串或 JSON 文字解析出資料 */
export function extractToken(text) {
  const s = String(text ?? '').trim();
  const m = s.match(/(?:^|[#&?])(?:coc|import)=([A-Za-z0-9_\-=%]+)/);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

export function decodeInput(text) {
  const s = extractToken(text);
  if (!s) throw new CodecError('沒有資料，請貼上分享連結或資料');
  let json;
  if (s.startsWith('{') || s.startsWith('[')) json = s;
  else json = b64urlToUtf8(s);
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new CodecError('資料格式不正確（JSON 解析失敗）');
  }
  return normalizePayload(obj);
}

/** 嘗試解碼，失敗回傳 null（不丟例外） */
export function tryDecode(text) {
  try {
    return decodeInput(text);
  } catch {
    return null;
  }
}

export function summarizeItems(items) {
  return items.map((it) => `${it.item} x${it.qty || 1}`).join('、');
}
