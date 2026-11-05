// 書籤②「一鍵點餐」入口
// 讀取順序：網址 #coc= → 剪貼簿 → 讓使用者貼上／選本站 localStorage 已存的組合
import { runRestore } from './restore-core.js';
import { loadLocalSets } from './save-core.js';
import { ask, h, mount, toast } from './ui.js';
import { tryDecode, summarizeItems } from '../shared/codec.js';
import { describeIssue, replaceable, choosable } from '../shared/compare.js';

function readHash() {
  const m = location.hash.match(/[#&]coc=([^&]+)/);
  if (!m) return null;
  const data = tryDecode(m[1]);
  // 讀完就把 #coc= 從網址拿掉，避免重新整理後重複點
  try {
    const rest = location.hash.replace(/[#&]coc=[^&]+/, '').replace(/^&/, '');
    history.replaceState(history.state, '', location.pathname + location.search + (rest && rest !== '#' ? (rest[0] === '#' ? rest : '#' + rest) : ''));
  } catch { /* 忽略 */ }
  return data;
}

async function readClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.readText) return null;
  try {
    const t = await Promise.race([navigator.clipboard.readText(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    return tryDecode(t);
  } catch {
    return null;
  }
}

/** 剪貼簿讀不到時：讓使用者貼上，或選本機已存的組合 */
function askForData(local) {
  return new Promise((resolve) => {
    const ta = h('textarea', { placeholder: '在這裡長按 → 貼上從 App 複製的資料' });
    const err = h('p', { class: 'mut' });
    let m;
    const done = (v) => { m.close(); resolve(v); };
    const tryUse = (text) => {
      const d = tryDecode(text);
      if (d) done(d);
      else err.textContent = '⚠ 看不懂這段資料，請確認是從「波奇一鍵點餐」App 複製的。';
    };
    m = mount([
      h('h2', null, '一鍵點餐：要點哪一組？'),
      h('p', { class: 'mut' }, '沒有讀到 App 傳來的資料（剪貼簿可能需要你同意存取）。'),
      ta,
      err,
      h('div', { class: 'btns' },
        navigator.clipboard && navigator.clipboard.readText && h('button', { type: 'button', onclick: async () => { try { tryUse(await navigator.clipboard.readText()); } catch { err.textContent = '⚠ 無法讀取剪貼簿，請手動貼上。'; } } }, '讀取剪貼簿'),
        h('button', { class: 'pri', type: 'button', onclick: () => tryUse(ta.value) }, '使用貼上的資料'),
      ),
      local.length ? h('div', null, h('p', null, h('b', null, '或使用這個瀏覽器存過的：')), local.map((s) => h('button', { class: 'list', type: 'button', onclick: () => done({ sets: [s] }) }, `${s.name}｜${summarizeItems(s.items)}`))) : null,
      h('div', { class: 'btns' }, h('button', { type: 'button', onclick: () => done(null) }, '取消')),
    ]);
  });
}

function chooseSet(sets) {
  if (sets.length === 1) return Promise.resolve(sets[0]);
  return new Promise((resolve) => {
    let m;
    m = mount([
      h('h2', null, '要點哪一組？'),
      sets.map((s) => h('button', { class: 'list', type: 'button', onclick: () => { m.close(); resolve(s); } }, h('b', null, s.name), h('div', { class: 'mut' }, summarizeItems(s.items)))),
      h('div', { class: 'btns' }, h('button', { type: 'button', onclick: () => { m.close(); resolve(null); } }, '取消')),
    ]);
  });
}

/** 變動提示面板 */
async function confirmIssues(issues, stage, item) {
  const picks = {};
  const list = issues.map((is, k) => {
    let sel = null;
    if (choosable(is)) {
      const sug = is.suggestions.map((s) => s.name);
      const others = (is.choices || []).filter((n) => !sug.includes(n));
      sel = h('select', { onchange: (e) => { picks[k] = e.target.value; } },
        sug.map((n) => h('option', { value: n }, `建議改用：${n}`)),
        h('option', { value: '', selected: !sug.length }, '這項略過'),
        others.map((n) => h('option', { value: n }, `改用：${n}`)));
    }
    const note = /price$/.test(is.kind) ? '（只是提醒，會照常點）' : !replaceable(is) ? '（沒有名稱相近的項目；預設略過，也可以從選單手動挑）' : '';
    return h('div', { class: 'issue' }, h('b', null, '⚠ '), describeIssue(is), note && h('div', { class: 'mut' }, note), sel);
  });
  const hasReplace = issues.some(choosable);
  const mode = await ask({
    title: stage === 'menu' ? '菜單和紀錄不一樣' : `「${item.item}」的選項有變動`,
    body: [h('p', { class: 'mut' }, '店家可能改了菜單。「用建議替代」會照下拉選單的選擇替換；「略過繼續」會跳過有問題的項目。'), ...list],
    buttons: [
      { label: '取消', value: 'cancel' },
      { label: '略過繼續', value: 'skip', primary: !hasReplace },
      hasReplace && { label: '用建議替代', value: 'replace', primary: true },
    ].filter(Boolean),
  });
  return { mode, picks };
}

(async function () {
  if (window.__pokeRunning) { toast('一鍵點餐執行中，請稍候…'); return; }
  if (!/cashier\.tw$/.test(location.hostname) && !confirm('這個頁面看起來不是電小二點餐頁，仍要執行一鍵點餐嗎？')) return;
  window.__pokeRunning = true;
  let progress;
  try {
    let data = readHash() || (await readClipboard());
    if (!data) data = await askForData(loadLocalSets());
    if (!data) return;
    const set = await chooseSet(data.sets);
    if (!set) return;
    const label = h('span', null, '準備中…');
    progress = mount([h('b', null, `一鍵點餐：${set.name}`), h('div', { class: 'mut' }, label)], { bar: true });
    const res = await runRestore(set, {
      confirm: confirmIssues,
      onProgress: (i, n, it) => { label.textContent = `第 ${i + 1}/${n} 份：${it.item}…（請勿操作畫面）`; },
    });
    progress.close();
    progress = null;
    const body = [];
    if (res.cancelled) body.push(h('p', null, res.modalLeftOpen ? '已取消。請自行關閉目前的選項視窗。' : '已取消，剩下的沒有加入。'));
    body.push(h('p', null, h('b', null, '已加入購物車：')), res.ok.length ? h('ul', null, res.ok.map((x) => h('li', null, x))) : h('p', null, '（無）'));
    if (res.bad.length) body.push(h('p', null, h('b', null, '⚠ 沒加入／有問題：')), h('ul', null, res.bad.map((x) => h('li', null, x))));
    body.push(h('p', null, '👉 請自己打開購物車檢查內容，確認無誤後再結帳。'));
    await ask({ title: res.cancelled ? '一鍵點餐已停止' : '一鍵點餐完成', body, buttons: [{ label: '知道了', value: 1, primary: true }] });
  } catch (e) {
    toast('一鍵點餐發生錯誤：' + (e && e.message), 8000);
  } finally {
    if (progress) progress.close();
    window.__pokeRunning = false;
  }
})();
