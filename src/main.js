import './style.css';
import { encodeSets, decodeInput, summarizeItems, CodecError } from './shared/codec.js';
import { load, save, importSets, isValidOrderUrl, buildOrderUrl, resolveOrderUrl, applyIncomingReturnUrl, setSessionOrderUrl } from './app/store.js';
import { installHtml } from './app/install.js';
import bookmarklets from './generated/bookmarklets.json';

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById('app');
let state = load();
let pendingImport = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const appUrl = () => location.origin + BASE;

// ---------- 共用小工具 ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}

function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}

/** 對話框：html 內容 + 按鈕，回傳被按下按鈕的 value（關閉 = null） */
function dialog(html, buttons = [{ label: '關閉', value: null }], onMount) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}<div class="row end">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return done(null);
      const b = e.target.closest('button[data-i]');
      if (b) {
        const btn = buttons[+b.dataset.i];
        const v = typeof btn.value === 'function' ? btn.value(wrap) : btn.value;
        if (v === undefined && btn.keep) return; // 驗證失敗時不關閉
        done(v);
      }
    });
    document.body.appendChild(wrap);
    onMount && onMount(wrap);
    const f = wrap.querySelector('input,textarea');
    if (f) f.focus();
  });
}

async function askText(title, value) {
  const v = await dialog(`<h2>${esc(title)}</h2><input class="inp" type="text" maxlength="60" value="${esc(value)}">`,
    [{ label: '取消', value: null }, { label: '確定', cls: 'pri', value: (w) => w.querySelector('input').value.trim() }]);
  return v || null;
}

const persist = () => save(state);
const findSet = (id) => state.sets.find((s) => s.id === id);

// ---------- 動作 ----------
async function share(sets, title) {
  const url = `${appUrl()}#import=${encodeSets(sets)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `波奇一鍵點餐：${title}`, text: `匯入我的常點組合「${title}」`, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  if (await copyText(url)) toast('分享連結已複製');
  else dialog(`<h2>分享連結</h2><textarea class="inp" readonly rows="5">${esc(url)}</textarea>`);
}

/**
 * 點餐：點一下就開點餐頁（網址帶 #coc=），在點餐頁按書籤就會自動還原。
 * 必須在點擊事件中同步呼叫 window.open，避免被擋下彈出視窗。
 */
function quickOrder(set) {
  // 優先用書籤帶來的「這一桌」網址，不要用設定裡過期的舊單號
  const orderUrl = resolveOrderUrl(state.settings);
  if (!isValidOrderUrl(orderUrl)) { askOrderUrl(set); return; }
  const token = encodeSets([set]);
  const w = window.open(buildOrderUrl(orderUrl, token), '_blank');
  if (!w) { goOrder(set); return; } // 被擋下彈出視窗：改顯示「開啟點餐頁」按鈕
  try { w.opener = null; } catch { /* 忽略 */ }
  copyText(token); // 備用：點餐頁網址的資料遺失時，書籤可改用剪貼簿
  toast(`已開啟點餐頁：在網址列打書籤名稱（例如 poke）再點書籤，就會自動點「${set.name}」`);
}

/** 第一次使用：請使用者貼上點餐網址，存起來後直接開啟 */
async function askOrderUrl(set) {
  await dialog(`<h2>貼上點餐網址</h2>
    <p class="mut">第一次使用請貼上電小二的點餐網址（https://shop.cashier.tw/online/menu/order/…），只會存在這台手機，之後點餐點卡片就會直接開啟。</p>
    <input class="inp" type="url" inputmode="url" placeholder="https://shop.cashier.tw/online/menu/order/…">
    <p class="err" hidden>請貼上 https://…cashier.tw/ 開頭的網址</p>`,
  [{ label: '取消', value: null }, {
    label: '儲存並開啟點餐頁', cls: 'pri', keep: true,
    value: (w) => {
      const v = w.querySelector('input').value.trim();
      if (!isValidOrderUrl(v)) { w.querySelector('.err').hidden = false; return undefined; }
      state.settings.orderUrl = v;
      setSessionOrderUrl(v);
      persist();
      quickOrder(set);
      return true;
    },
  }]);
}

async function goOrder(set) {
  const token = encodeSets([set]);
  const copied = await copyText(token);
  const orderUrl = resolveOrderUrl(state.settings);
  const hasUrl = isValidOrderUrl(orderUrl);
  await dialog(`
    <h2>去點餐：${esc(set.name)}</h2>
    ${copied ? '<p class="ok">✓ 已把餐點資料複製到剪貼簿</p>' : `<p class="err">無法自動複製，請手動複製下面的資料：</p><textarea class="inp" readonly rows="3">${esc(token)}</textarea>`}
    <ol class="steps-sm">
      <li>${hasUrl ? '按下方「開啟點餐頁」' : '用 <b>Brave／Chrome／Safari</b> 打開這次的電小二點餐網址（掃 QR 時選 Brave；不要用 LINE 內建瀏覽器）'}</li>
      <li>點網址列，輸入書籤名稱（例如 poke），點那個書籤（會自動讀取剪貼簿）</li>
      <li>等它自動加入購物車，<b>自己檢查後再結帳</b></li>
    </ol>
    ${hasUrl ? `<a class="btn pri block" href="${esc(buildOrderUrl(orderUrl, token))}" target="_blank" rel="noopener">開啟點餐頁</a>` : '<p class="mut">小技巧：到「設定」填入點餐網址，下次就能一鍵開啟。</p>'}
    <p class="mut">若點餐頁開在 App 內的小視窗（無法用書籤），請點選單裡的「在瀏覽器中開啟」，或改用 Brave／Safari 開啟。</p>`);
}

async function renameSet(set) {
  const n = await askText('重新命名', set.name);
  if (n) { set.name = n.slice(0, 60); persist(); render(); }
}

async function deleteSet(set) {
  const ok = await dialog(`<h2>刪除「${esc(set.name)}」？</h2><p>刪除後無法復原。</p>`, [{ label: '取消', value: false }, { label: '刪除', cls: 'danger', value: true }]);
  if (ok) {
    state.sets = state.sets.filter((s) => s !== set);
    persist();
    location.hash = '#/';
    toast('已刪除');
  }
}

// ---------- 畫面 ----------
function estimate(it) {
  if (typeof it.price !== 'number') return null;
  let p = it.price;
  for (const [g, list] of Object.entries(it.options || {})) for (const o of list) p += (it.optPrices && it.optPrices[g] && it.optPrices[g][o]) || 0;
  return p * (it.qty || 1);
}

function viewHome() {
  if (!state.sets.length) {
    return `<section class="card empty">
      <div class="big">🥗</div>
      <h2>還沒有常點組合</h2>
      <p>先到「教學」設定一個書籤。在電小二點餐頁按書籤、照平常加入購物車，再按一次書籤，餐點就會自動存到這裡。</p>
      <div class="row center"><a class="btn pri" href="#/install">看安裝教學</a><a class="btn" href="#/import">貼上資料匯入</a></div>
    </section>`;
  }
  return `<h1 class="ttl">常點組合</h1>
  <p class="mut">點一下餐點就會開啟點餐頁，再按書籤「一鍵點餐」自動加入購物車；菜單有變動會先提示。</p>${state.sets.map((s) => `
    <section class="card set">
      <button type="button" class="set-main" data-act="quick" data-id="${esc(s.id)}" aria-label="點餐：${esc(s.name)}">
        <h2>${esc(s.name)} <span class="go">點餐 ›</span></h2>
        <p class="mut">${s.items.length} 份｜${esc(summarizeItems(s.items))}</p>
      </button>
      <div class="row">
        <a class="btn grow" href="#/set/${esc(s.id)}">檢視</a>
        <button class="btn" data-act="share" data-id="${esc(s.id)}" aria-label="分享">分享</button>
      </div>
    </section>`).join('')}`;
}

function viewSet(id) {
  const s = findSet(id);
  if (!s) return `<section class="card"><p>找不到這組餐點。</p><a class="btn" href="#/">回列表</a></section>`;
  const total = s.items.reduce((a, it) => (a === null || estimate(it) === null ? null : a + estimate(it)), 0);
  return `
  <a class="back" href="#/">‹ 常點組合</a>
  <h1 class="ttl">${esc(s.name)}</h1>
  <p class="mut">儲存於 ${fmtDate(s.savedAt)}・共 ${s.items.length} 份${total !== null ? `・紀錄時約 $${total}` : ''}</p>
  ${s.items.map((it, i) => {
    const groups = Object.entries(it.options || {}).filter(([, l]) => l.length);
    const est = estimate(it);
    return `<section class="card item">
      <div class="row between"><h2>${i + 1}. ${esc(it.item)} <span class="qty">x${it.qty || 1}</span></h2>${est !== null ? `<span class="mut">$${est}</span>` : ''}</div>
      ${groups.length ? `<dl>${groups.map(([g, l]) => {
        const counts = {};
        l.forEach((o) => { counts[o] = (counts[o] || 0) + 1; });
        return `<dt>${esc(g)}</dt><dd>${Object.entries(counts).map(([o, n]) => {
          const p = it.optPrices && it.optPrices[g] && it.optPrices[g][o];
          return `<span class="chip">${esc(o)}${n > 1 ? ` ×${n}` : ''}${p ? ` <small>+${p}</small>` : ''}</span>`;
        }).join('')}</dd>`;
      }).join('')}</dl>` : '<p class="mut">（無選項）</p>'}
      ${it.comment ? `<p class="comment">備註：${esc(it.comment)}</p>` : ''}
    </section>`;
  }).join('')}
  <div class="actions">
    <button class="btn pri block" data-act="quick" data-id="${esc(s.id)}">去點餐</button>
    <button class="btn block" data-act="order" data-id="${esc(s.id)}">用剪貼簿點餐（沒有點餐網址時）</button>
    <div class="row">
      <button class="btn grow" data-act="rename" data-id="${esc(s.id)}">改名</button>
      <button class="btn grow" data-act="share" data-id="${esc(s.id)}">分享連結</button>
      <button class="btn grow" data-act="copy" data-id="${esc(s.id)}">複製資料</button>
    </div>
    <button class="btn danger block" data-act="delete" data-id="${esc(s.id)}">刪除這組</button>
  </div>`;
}

function viewImport() {
  const text = pendingImport || '';
  let preview = '';
  if (text) {
    try {
      const { sets } = decodeInput(text);
      preview = `<section class="card"><h2>要匯入這 ${sets.length} 組嗎？</h2>
        <ul class="plain">${sets.map((s) => `<li><b>${esc(s.name)}</b><br><span class="mut">${esc(summarizeItems(s.items))}</span></li>`).join('')}</ul>
        <div class="row"><button class="btn" data-act="import-cancel">取消</button><button class="btn pri grow" data-act="import-do">匯入</button></div></section>`;
    } catch (e) {
      preview = `<p class="err">⚠ ${esc(e instanceof CodecError ? e.message : '資料格式不正確')}</p>`;
    }
  }
  return `<h1 class="ttl">匯入餐點</h1>
  ${preview}
  <section class="card">
    <p>貼上朋友給你的分享連結或資料（用書籤存的餐點會自動匯入，不用來這裡）：</p>
    <textarea id="importText" class="inp" rows="5" placeholder="https://…#import=… 或資料字串">${esc(text)}</textarea>
    <div class="row">
      ${navigator.clipboard && navigator.clipboard.readText ? '<button class="btn" data-act="paste">讀取剪貼簿</button>' : ''}
      <button class="btn pri grow" data-act="import-check">檢查資料</button>
    </div>
  </section>`;
}

function viewSettings() {
  const s = state.settings;
  return `<h1 class="ttl">設定</h1>
  <section class="card">
    <h2>點餐網址（選填）</h2>
    <p class="mut">填入電小二的點餐網址（https://shop.cashier.tw/online/menu/order/…），點餐點卡片就會直接開啟它，並在網址後帶上餐點資料。網址只存在這台手機。用書籤「從 App 選餐點」進來時，會自動接上目前這一桌，不會用到過期的舊單號。</p>
    <input id="orderUrl" class="inp" type="url" inputmode="url" placeholder="https://shop.cashier.tw/online/menu/order/…" value="${esc(s.orderUrl)}">
    <div class="row"><button class="btn pri grow" data-act="save-url">儲存</button></div>
  </section>
  <section class="card">
    <h2>外觀</h2>
    <div class="seg">${[['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"${s.theme === v ? ' checked' : ''}> ${l}</label>`).join('')}</div>
  </section>
  <section class="card">
    <h2>資料</h2>
    <p class="mut">共 ${state.sets.length} 組常點組合，只存在這台手機的瀏覽器中。</p>
    <div class="row">
      <button class="btn grow" data-act="share-all"${state.sets.length ? '' : ' disabled'}>分享／備份全部</button>
      <button class="btn danger grow" data-act="clear"${state.sets.length ? '' : ' disabled'}>清除全部</button>
    </div>
  </section>
  <p class="mut center">波奇一鍵點餐・資料格式 v1・不會自動結帳</p>`;
}

function viewInstall() {
  return `<h1 class="ttl">安裝教學</h1>${installHtml(bookmarklets)}`;
}

function render() {
  const h = location.hash || '#/';
  let html;
  let tab = 'home';
  const m = h.match(/^#\/set\/([\w-]+)/);
  if (m) html = viewSet(m[1]);
  else if (h.startsWith('#/import')) { html = viewImport(); tab = 'import'; }
  else if (h.startsWith('#/settings')) { html = viewSettings(); tab = 'settings'; }
  else if (h.startsWith('#/install')) { html = viewInstall(); tab = 'install'; }
  else html = viewHome();
  app.innerHTML = html;
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  if (tab === 'install') {
    app.querySelectorAll('a.drag').forEach((a) => { a.href = bookmarklets.oneclick; });
  }
  window.scrollTo(0, 0);
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- 事件 ----------
app.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act],[data-copy]');
  if (!b) return;
  if (b.dataset.copy) {
    const ok = await copyText(bookmarklets.oneclick);
    b.textContent = ok ? '已複製 ✓ 接著做步驟 2' : '複製失敗，請再按一次';
    toast(ok ? `已複製短書籤（${bookmarklets.oneclick.length} 字）！接著照步驟 2 新增書籤` : '複製失敗，請改用電腦拖曳或重試');
    return;
  }
  const set = b.dataset.id ? findSet(b.dataset.id) : null;
  switch (b.dataset.act) {
    case 'quick': if (set) quickOrder(set); break;
    case 'order': if (set) goOrder(set); break;
    case 'share': if (set) share([set], set.name); break;
    case 'copy': if (set) toast((await copyText(encodeSets([set]))) ? '資料已複製' : '複製失敗'); break;
    case 'rename': if (set) renameSet(set); break;
    case 'delete': if (set) deleteSet(set); break;
    case 'paste':
      try { pendingImport = await navigator.clipboard.readText(); render(); } catch { toast('無法讀取剪貼簿，請長按輸入框貼上'); }
      break;
    case 'import-check': pendingImport = document.getElementById('importText').value.trim(); render(); break;
    case 'import-cancel': pendingImport = null; render(); break;
    case 'import-do': {
      try {
        const { sets } = decodeInput(pendingImport);
        const n = importSets(state, sets);
        pendingImport = null;
        toast(n ? `已匯入 ${n} 組` : '這些組合已經存在');
        location.hash = '#/';
      } catch (err) {
        toast(err.message || '匯入失敗');
      }
      break;
    }
    case 'save-url': {
      const v = document.getElementById('orderUrl').value.trim();
      if (v && !isValidOrderUrl(v)) { toast('請填入 https://…cashier.tw/ 開頭的網址'); return; }
      state.settings.orderUrl = v;
      if (!v) setSessionOrderUrl('');
      persist();
      toast(v ? '已儲存點餐網址' : '已清除點餐網址');
      break;
    }
    case 'share-all': share(state.sets, `全部 ${state.sets.length} 組`); break;
    case 'clear': {
      const ok = await dialog('<h2>清除全部常點組合？</h2><p>刪除後無法復原，建議先「分享／備份全部」。</p>', [{ label: '取消', value: false }, { label: '全部清除', cls: 'danger', value: true }]);
      if (ok) { state.sets = []; persist(); render(); toast('已清除'); }
      break;
    }
    default:
  }
});

app.addEventListener('change', (e) => {
  if (e.target.name === 'theme') {
    state.settings.theme = e.target.value;
    persist();
    applyTheme();
  }
});

/**
 * 處理網址帶進來的資料：
 *  #return=… → 書籤「從 App 選餐點」帶來的目前訂餐頁（只存本機／本分頁）
 *  #import=… → 直接自動匯入（書籤存的餐點、朋友的分享連結），不用再按「匯入」
 *  #coc=…    → 進匯入頁預覽
 */
function takeIncoming() {
  const h = location.hash;
  if (/^#return=/.test(h)) {
    const r = applyIncomingReturnUrl(h, state.settings);
    if (r.applied) {
      state.settings.orderUrl = r.orderUrl;
      persist();
      toast('已接上目前這一桌的點餐頁，按「點餐」會回到這裡');
    }
    history.replaceState(null, '', location.pathname + location.search + '#/');
    return;
  }
  if (/^#import=/.test(h)) {
    let sets = null;
    try { sets = decodeInput(h.slice(1)).sets; } catch { sets = null; }
    if (sets) {
      const n = importSets(state, sets);
      history.replaceState(null, '', location.pathname + location.search + '#/');
      toast(n ? `已匯入「${sets.map((s) => s.name).join('、')}」` : '這組餐點已經在清單裡');
      return;
    }
  }
  if (/^#(import|coc)=/.test(h)) {
    pendingImport = h.slice(1);
    history.replaceState(null, '', location.pathname + location.search + '#/import');
  }
}

window.addEventListener('hashchange', () => { takeIncoming(); render(); });
window.addEventListener('storage', () => { state = load(); render(); });
takeIncoming();
applyTheme();
render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {}));
}
