// 書籤①「存餐點」入口
import { startRecording, saveLocalSet } from './save-core.js';
import { mount, h, toast, copyText, ask } from './ui.js';
import { encodeSets } from '../shared/codec.js';

/* global __PWA_URL__ */
const PWA_URL = typeof __PWA_URL__ !== 'undefined' ? __PWA_URL__ : '';

(function () {
  if (window.__pokeRec) {
    toast('已經在記錄中，請按下方的「完成並儲存」。');
    return;
  }
  const count = h('span', null, '0');
  const lastEl = h('div', { class: 'mut' }, '照平常選好餐點按「加入購物車」，每一份都會被記住。');
  let bar;
  const rec = startRecording((r, list) => {
    count.textContent = String(list.length);
    lastEl.textContent = `剛記住：${r.item} x${r.qty}`;
  }, {
    onReject: (r) => {
      lastEl.textContent = `「${r.item}」沒有加入購物車，所以沒記下。`;
      toast(`「${r.item}」好像沒有成功加入購物車（可能還有必選項沒選完），這份沒有記下。\n選好後再按一次「加入購物車」即可。`, 5000);
    },
  });
  window.__pokeRec = rec;

  const finish = async () => {
    if (!rec.list.length) {
      toast('還沒有記住任何餐點，請先按「加入購物車」。');
      return;
    }
    bar.close();
    const d = new Date();
    const input = h('input', { type: 'text', value: `我的餐點 ${d.getMonth() + 1}/${d.getDate()}`, maxLength: 60 });
    const summary = h('ul', null, rec.list.map((x) => h('li', null, `${x.item} x${x.qty}`)));
    const v = await ask({
      title: `替這組餐點取個名字（共 ${rec.list.length} 份）`,
      body: [summary, input, h('p', { class: 'mut' }, '例如：小明的鮮魚波奇')],
      buttons: [
        { label: '繼續記錄', value: 'back' },
        { label: '儲存', value: 'save', primary: true },
      ],
    });
    if (v === 'back') {
      showBar();
      return;
    }
    rec.stop();
    window.__pokeRec = null;
    const set = saveLocalSet(input.value.trim() || '我的餐點', rec.list);
    const token = encodeSets([set]);
    const importUrl = PWA_URL ? `${PWA_URL}#import=${token}` : '';
    const done = mount([
      h('h2', null, `已儲存「${set.name}」`),
      h('p', null, `共 ${set.items.length} 份，已存在這個瀏覽器（之後也能直接用「一鍵點餐」）。`),
      h('p', { class: 'mut' }, '建議匯入到「波奇一鍵點餐」App，方便管理多組常點組合、分享給朋友。'),
      h('div', { class: 'btns' },
        importUrl && h('button', { class: 'pri', type: 'button', onclick: () => { window.open(importUrl, '_blank'); } }, '匯入到 App'),
        h('button', { type: 'button', onclick: async (e) => { const ok = await copyText(importUrl || token); e.target.textContent = ok ? '已複製 ✓' : '複製失敗'; } }, importUrl ? '複製匯入連結' : '複製資料'),
        h('button', { type: 'button', onclick: () => done.close() }, '關閉'),
      ),
    ]);
  };

  const showBar = () => {
    bar = mount([
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('b', null, '● 記錄中：已記住 ', count, ' 份'), lastEl),
      ),
      h('div', { class: 'btns' },
        h('button', { type: 'button', onclick: () => { rec.stop(); window.__pokeRec = null; bar.close(); toast('已取消記錄。'); } }, '取消'),
        h('button', { class: 'pri', type: 'button', onclick: finish }, '完成並儲存'),
      ),
    ], { bar: true });
  };
  showBar();
})();
