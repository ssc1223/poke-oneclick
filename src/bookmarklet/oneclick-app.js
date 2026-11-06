// 合併書籤「一鍵點餐」：一個書籤搞定存餐點與點餐
//  1. 網址有 #coc= → 自動還原點餐（保留變動提示）
//  2. 已記錄到加入購物車的品項 → 存成餐點，直接開 App 的 #import= 自動匯入
//  3. 購物車是空的 → 顯示簡單選單（從 App 選餐點），並在背景開始記錄
import { runRestore } from './restore-core.js';
import { startRecording, saveLocalSet, loadLocalSets } from './save-core.js';
import { chooseSet, confirmIssues, showReport } from './restore-ui.js';
import { decideAction, readCocToken, stripCoc, defaultSetName, buildImportUrl, buildAppSelectUrl, normalizeOrderPageUrl } from './oneclick-core.js';
import { h, mount, toast, copyText } from './ui.js';
import { tryDecode, summarizeItems } from '../shared/codec.js';

/* global __PWA_URL__ */
const DEFAULT_PWA_URL = typeof __PWA_URL__ !== 'undefined' ? __PWA_URL__ : '';

const recorded = () => (window.__pokeRec && window.__pokeRec.list ? window.__pokeRec.list.length : 0);

function stopRecording() {
  const s = window.__pokeRec;
  if (s) { s.stop(); if (s.bar) s.bar.close(); }
  window.__pokeRec = null;
}

/** 把 #coc= 從網址拿掉，避免重新整理後重複點 */
function consumeCoc() {
  try {
    history.replaceState(history.state, '', location.pathname + location.search + stripCoc(location.hash));
  } catch { /* 忽略 */ }
}

async function restore(data, opts) {
  if (!data || !data.sets || !data.sets.length) { toast('看不懂網址裡的餐點資料，請回 App 重新點一次。', 6000); return { action: 'restore', error: 'decode' }; }
  stopRecording(); // 避免把自動點的品項也記進去
  const set = await (opts.choose || chooseSet)(data.sets);
  if (!set) return { action: 'restore', cancelled: true };
  const label = h('span', null, '準備中…');
  const progress = mount([h('b', null, `一鍵點餐：${set.name}`), h('div', { class: 'mut' }, label)], { bar: true });
  try {
    const res = await runRestore(set, {
      confirm: opts.confirm || confirmIssues,
      scale: opts.scale,
      onProgress: (i, n, it) => { label.textContent = `第 ${i + 1}/${n} 份：${it.item}…（請勿操作畫面）`; },
    });
    progress.close();
    if (opts.report !== false) await (opts.report || showReport)(res);
    return { action: 'restore', set, res };
  } finally {
    progress.close();
  }
}

/** 存成餐點並開 App 自動匯入 */
function saveAndImport(opts) {
  const s = window.__pokeRec;
  const items = s.list.slice();
  stopRecording();
  const set = saveLocalSet(defaultSetName(items), items);
  const url = buildImportUrl(opts.pwaUrl, set);
  const w = opts.pwaUrl ? opts.open(url) : null;
  if (w) {
    toast(`已存成「${set.name}」，正在開啟 App 匯入…\n名稱可以在 App 裡修改。`, 5000);
  } else {
    // 被瀏覽器擋下彈出視窗：給一個按鈕讓使用者自己點
    const m = mount([
      h('h2', null, `已存成「${set.name}」`),
      h('p', null, `共 ${items.length} 份。按下方按鈕開啟 App 就會自動匯入。`),
      h('div', { class: 'btns' },
        opts.pwaUrl && h('a', { class: 'btnlink pri', href: url, target: '_blank', rel: 'noopener', onclick: () => setTimeout(() => m.close(), 300) }, '開啟 App 匯入'),
        h('button', { type: 'button', onclick: async (e) => { e.target.textContent = (await copyText(url)) ? '已複製 ✓' : '複製失敗'; } }, '複製匯入連結'),
        h('button', { type: 'button', onclick: () => m.close() }, '關閉'),
      ),
    ]);
  }
  return { action: 'save', set, url, opened: !!w };
}

function showRecordingBar(opts) {
  const s = window.__pokeRec;
  const count = h('span', null, String(s.list.length));
  const lastEl = h('div', { class: 'mut' }, '照平常點餐，按「加入購物車」就會記住。完成後再按一次書籤。');
  s.onAdd = (r, list) => { count.textContent = String(list.length); lastEl.textContent = `剛記住：${r.item} x${r.qty}`; };
  s.onReject = (r) => { lastEl.textContent = `「${r.item}」沒有成功加入購物車，所以沒記下。`; };
  s.bar = mount([
    h('div', null, h('b', null, '● 記錄中：已記住 ', count, ' 份'), lastEl),
    h('div', { class: 'btns' },
      h('button', { type: 'button', onclick: () => { stopRecording(); toast('已停止記錄。'); } }, '停止'),
      h('button', { class: 'pri', type: 'button', onclick: () => { if (recorded()) saveAndImport(opts); else toast('還沒有記住任何餐點，請先按「加入購物車」。'); } }, '存成餐點'),
    ),
  ], { bar: true });
}

function ensureRecording(opts) {
  if (window.__pokeRec) return;
  const session = { list: [], bar: null, onAdd: null, onReject: null, stop: () => {} };
  const rec = startRecording((r, list) => session.onAdd && session.onAdd(r, list), {
    ...(opts.recOpts || {}),
    onReject: (r) => session.onReject && session.onReject(r),
  });
  session.list = rec.list;
  session.stop = rec.stop;
  window.__pokeRec = session;
  showRecordingBar(opts);
}

/** 購物車為空時的簡單選單 */
function showMenu(opts) {
  ensureRecording(opts);
  const local = loadLocalSets();
  return new Promise((resolve) => {
    let m;
    const done = (v) => { m.close(); resolve(v); };
    const err = h('p', { class: 'mut' });
    const ta = h('textarea', { placeholder: '長按 → 貼上從 App 複製的資料' });
    const useText = (text) => {
      const d = tryDecode(text);
      if (d) done({ data: d });
      else err.textContent = '⚠ 看不懂這段資料，請確認是從「波奇一鍵點餐」App 複製的。';
    };
    m = mount([
      h('h2', null, '波奇一鍵點餐'),
      h('p', { class: 'mut' }, '已開始記錄：照平常把餐點「加入購物車」，完成後再按一次這個書籤，就會存成餐點並匯入 App。'),
      h('div', { class: 'btns' },
        h('button', { class: 'pri', type: 'button', 'data-act': 'app', onclick: () => {
          if (opts.pwaUrl) {
            // 帶上目前這一桌的訂餐頁，讓 App「點餐」不要用舊單號
            let pageUrl = '';
            try { pageUrl = normalizeOrderPageUrl(opts.pageHref || location.href); } catch { pageUrl = ''; }
            const appUrl = buildAppSelectUrl(opts.pwaUrl, pageUrl);
            const w = opts.open(appUrl);
            // 手機 Brave 常擋 window.open：改同分頁導向（書籤本來就會離開點餐頁）
            if (!w) {
              try { (opts.navigate || ((u) => { location.assign(u); }))(appUrl); } catch { /* 忽略 */ }
            }
          }
          done({ app: true });
        } }, '從 App 選餐點'),
        navigator.clipboard && navigator.clipboard.readText && h('button', { type: 'button', onclick: async () => { try { useText(await navigator.clipboard.readText()); } catch { err.textContent = '⚠ 無法讀取剪貼簿，請在下方貼上。'; } } }, '用剪貼簿的餐點'),
      ),
      local.length ? h('div', null, h('p', { class: 'mut' }, '這個瀏覽器存過的：'), local.map((s) => h('button', { class: 'list', type: 'button', onclick: () => done({ data: { sets: [s] } }) }, `${s.name}｜${summarizeItems(s.items)}`))) : null,
      h('details', null, h('summary', { class: 'mut' }, '貼上資料'), ta, h('div', { class: 'btns' }, h('button', { type: 'button', onclick: () => useText(ta.value) }, '使用貼上的資料'))),
      err,
      h('div', { class: 'btns' }, h('button', { type: 'button', 'data-act': 'close', onclick: () => done(null) }, '關閉（繼續點餐）')),
    ]);
    if (opts.onMenu) opts.onMenu(m);
  });
}

/**
 * 書籤主程式。opts 主要給測試注入：
 *  pwaUrl, open(url) → window|null, confirm, choose, report, scale, recOpts, onMenu(panel), skipHostCheck
 */
export async function runOneClick(opts = {}) {
  const o = { pwaUrl: DEFAULT_PWA_URL, open: (u) => window.open(u, '_blank'), ...opts };
  if (window.__pokeRunning) { toast('一鍵點餐執行中，請稍候…'); return { action: 'busy' }; }
  if (!o.skipHostCheck && !/cashier\.tw$/.test(location.hostname) && !window.confirm('這個頁面看起來不是電小二點餐頁，仍要執行嗎？')) return { action: 'abort' };
  window.__pokeRunning = true;
  try {
    const action = decideAction({ hash: location.hash, recorded: recorded() });
    if (action === 'restore') {
      const token = readCocToken(location.hash);
      consumeCoc();
      return await restore(tryDecode(token), o);
    }
    if (action === 'save') return saveAndImport(o);
    const pick = await showMenu(o);
    if (pick && pick.data) return await restore(pick.data, o);
    return { action: 'menu', pick };
  } catch (e) {
    toast('一鍵點餐發生錯誤：' + (e && e.message), 8000);
    return { action: 'error', error: e };
  } finally {
    window.__pokeRunning = false;
  }
}
