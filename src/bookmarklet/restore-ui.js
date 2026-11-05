// 一鍵點餐的畫面部分：選組合、變動提示面板、完成報告（從原本的 restore.js 搬過來）
// 替代選項用按鈕列表，不用原生 <select>：Android（Brave／Chrome）在 Shadow DOM
// overlay 上點 select 常完全沒反應（系統選單開不起來或被外層 modal 搶走）。
import { ask, h, mount } from './ui.js';
import { summarizeItems } from '../shared/codec.js';
import { describeIssue, replaceable, choosable } from '../shared/compare.js';

export function chooseSet(sets) {
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

/**
 * 用按鈕列表選替代品項（觸控友善；不依賴原生 select）。
 * picks[k] 會在建立時設成預設值（第一個建議，或略過）。
 */
export function buildChoiceButtons(issue, k, picks) {
  const sug = (issue.suggestions || []).map((s) => s.name);
  const others = (issue.choices || []).filter((n) => !sug.includes(n));
  if (!Object.prototype.hasOwnProperty.call(picks, k)) {
    picks[k] = sug.length ? sug[0] : '';
  }

  const wrap = h('div', { class: 'choices', role: 'group', 'aria-label': '選擇替代方案' });

  const paint = () => {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    const add = (value, label) => {
      const on = picks[k] === value;
      wrap.appendChild(h('button', {
        type: 'button',
        class: 'choice',
        'aria-pressed': on ? 'true' : 'false',
        'data-choice': value === '' ? '__skip__' : value,
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          picks[k] = value;
          paint();
        },
      }, label));
    };
    for (const n of sug) add(n, `建議改用：${n}`);
    add('', '這項略過');
    for (const n of others) add(n, `改用：${n}`);
  };
  paint();
  return wrap;
}

/** 變動提示面板：店家改了菜單、售完或價格變動時讓使用者選擇 */
export async function confirmIssues(issues, stage, item) {
  const picks = {};
  const list = issues.map((is, k) => {
    const chooser = choosable(is) ? buildChoiceButtons(is, k, picks) : null;
    const note = /price$/.test(is.kind) ? '（只是提醒，會照常點）' : !replaceable(is) ? '（沒有名稱相近的項目；預設略過，也可以從下面手動挑）' : '';
    return h('div', { class: 'issue' }, h('b', null, '⚠ '), describeIssue(is), note && h('div', { class: 'mut' }, note), chooser);
  });
  const hasReplace = issues.some(choosable);
  const mode = await ask({
    title: stage === 'menu' ? '菜單和紀錄不一樣' : `「${item.item}」的選項有變動`,
    body: [h('p', { class: 'mut' }, '店家可能改了菜單。點下方按鈕選替代品項，「用建議替代」會照你的選擇替換；「略過繼續」會跳過有問題的項目。'), ...list],
    buttons: [
      { label: '取消', value: 'cancel' },
      { label: '略過繼續', value: 'skip', primary: !hasReplace },
      hasReplace && { label: '用建議替代', value: 'replace', primary: true },
    ].filter(Boolean),
  });
  return { mode, picks };
}

/** 一鍵點餐完成後的報告 */
export function showReport(res) {
  const body = [];
  if (res.cancelled) body.push(h('p', null, res.modalLeftOpen ? '已取消。請自行關閉目前的選項視窗。' : '已取消，剩下的沒有加入。'));
  body.push(h('p', null, h('b', null, '已加入購物車：')), res.ok.length ? h('ul', null, res.ok.map((x) => h('li', null, x))) : h('p', null, '（無）'));
  if (res.bad.length) body.push(h('p', null, h('b', null, '⚠ 沒加入／有問題：')), h('ul', null, res.bad.map((x) => h('li', null, x))));
  body.push(h('p', null, '👉 請自己打開購物車檢查內容，確認無誤後再結帳。'));
  return ask({ title: res.cancelled ? '一鍵點餐已停止' : '一鍵點餐完成', body, buttons: [{ label: '知道了', value: 1, primary: true }] });
}
