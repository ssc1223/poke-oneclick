// 合併書籤「一鍵點餐」的判斷邏輯（純函式，方便單元測試）
import { encodeSets } from '../shared/codec.js';

const COC_RE = /[#&]coc=([^&]+)/;

/** 從網址的 hash 取出 #coc= 後面的資料；沒有就回傳 null */
export function readCocToken(hash) {
  const m = String(hash || '').match(COC_RE);
  return m ? m[1] : null;
}

/** 把 coc=… 從 hash 拿掉，回傳剩下的 hash（沒剩東西就回傳空字串） */
export function stripCoc(hash) {
  const rest = String(hash || '').replace(/[#&]coc=[^&]*/, '').replace(/^&/, '');
  if (!rest || rest === '#') return '';
  return rest[0] === '#' ? rest : '#' + rest;
}

/**
 * 按下書籤時要做什麼：
 *  - 'restore'：網址有 #coc= → 自動還原點餐
 *  - 'save'   ：記錄到的購物車有品項 → 存成餐點並跳回 App 匯入
 *  - 'menu'   ：購物車是空的 → 顯示簡單選單
 */
export function decideAction({ hash, recorded = 0 } = {}) {
  if (readCocToken(hash)) return 'restore';
  if (recorded > 0) return 'save';
  return 'menu';
}

/** 預設的餐點名稱，例如「創意自選波奇 等 2 份 11/5」；之後可在 App 裡改名 */
export function defaultSetName(items, date = new Date()) {
  const first = items && items[0] ? items[0].item : '我的餐點';
  const n = (items || []).reduce((a, it) => a + (it.qty || 1), 0);
  return `${first}${n > 1 ? ` 等 ${n} 份` : ''} ${date.getMonth() + 1}/${date.getDate()}`;
}

/** 產生跳回 App 自動匯入的網址：<PWA 網址>#import=<資料> */
export function buildImportUrl(pwaUrl, set) {
  const base = String(pwaUrl || '').split('#')[0];
  return `${base}#import=${encodeSets([set])}`;
}
