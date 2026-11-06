/**
 * 訂餐頁網址處理（PWA 與書籤共用）。
 * 注意：真實單號只應留在使用者裝置上，不要寫進分享資料或 repo。
 */

/** 去掉 hash，得到要返回的訂餐頁網址（不含 #coc=） */
export function normalizeOrderPageUrl(href) {
  const u = new URL(String(href || ''), 'https://shop.cashier.tw');
  u.hash = '';
  return u.toString().replace(/#$/, '');
}

/**
 * 從書籤「從 App 選餐點」開 App：帶上目前這一桌的訂餐頁。
 * 格式：<PWA>#return=<encodeURIComponent(訂餐頁)>
 */
export function buildAppSelectUrl(pwaUrl, orderPageUrl) {
  const base = String(pwaUrl || '').split('#')[0];
  if (!orderPageUrl) return base;
  return `${base}#return=${encodeURIComponent(normalizeOrderPageUrl(orderPageUrl))}`;
}

/** 從 App 網址 hash 讀出 #return= 的訂餐頁；沒有或解碼失敗回 null */
export function readReturnUrl(hash) {
  const m = String(hash || '').match(/^#return=(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
