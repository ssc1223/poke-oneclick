// Playwright：模擬書籤選單「從 App 選餐點」帶上目前訂餐頁
import { buildAppSelectUrl, normalizeOrderPageUrl, readReturnUrl } from '../../src/shared/order-url.js';
import { applyIncomingReturnUrl, resolveOrderUrl, setSessionOrderUrl, SESSION_ORDER_KEY } from '../../src/app/store.js';
import { buildOrderUrl } from '../../src/app/store.js';
import { encodeSets } from '../../src/shared/codec.js';

window.__orderUrlHelpers = {
  buildAppSelectUrl,
  normalizeOrderPageUrl,
  readReturnUrl,
  applyIncomingReturnUrl,
  resolveOrderUrl,
  setSessionOrderUrl,
  buildOrderUrl,
  encodeSets,
  SESSION_ORDER_KEY,
};
