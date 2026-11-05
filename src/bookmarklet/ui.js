// 書籤用的浮動面板（Shadow DOM 隔離樣式，避免和電小二頁面互相影響）

const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}
.wrap{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);padding:8px}
.wrap.bar{inset:8px 8px auto auto;background:none;padding:0;max-width:calc(100% - 16px)}
.bar .card{max-width:340px;padding:10px 12px;font-size:14px;border-radius:12px}
.bar .btns{margin-top:6px}
.bar button{min-height:38px;font-size:14px;padding:6px 10px}
.card{--bg:#fff;--fg:#1d1d1f;--mut:#666;--line:#e3e3e3;--acc:#e8590c;--warn:#b3261e;background:var(--bg);color:var(--fg);width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:16px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);font-size:16px;line-height:1.5}
@media (prefers-color-scheme:dark){.card{--bg:#1f1f22;--fg:#f2f2f2;--mut:#aaa;--line:#3a3a3e;--acc:#ff8a3d;--warn:#ff8a80}}
h2{margin:0 0 8px;font-size:18px}
p{margin:6px 0}
.mut{color:var(--mut);font-size:14px}
ul{margin:8px 0;padding-left:20px}
li{margin:4px 0}
.issue{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0}
.issue b{color:var(--warn)}
select,input,textarea{width:100%;font-size:16px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);margin-top:6px}
textarea{min-height:90px}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
button{flex:1 1 auto;min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--fg);padding:8px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
a.btnlink{flex:1 1 auto;display:flex;align-items:center;justify-content:center;min-height:44px;font-size:16px;border-radius:10px;padding:8px 12px;text-decoration:none;background:var(--acc);color:#fff;font-weight:600}
summary{cursor:pointer;margin-top:10px}
button.pri{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
button.list{display:block;width:100%;text-align:left;margin:6px 0}
.choices{display:flex;flex-direction:column;gap:6px;margin-top:8px}
button.choice{flex:none;width:100%;text-align:left;margin:0}
button.choice[aria-pressed="true"]{border-color:var(--acc);background:var(--acc);color:#fff;font-weight:600}
.row{display:flex;align-items:center;gap:8px}
.row .grow{flex:1}
`;

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

/** 建立一個掛在頁面上的面板，回傳 { root, close } */
export function mount(content, { bar = false } = {}) {
  const host = h('div', { 'data-poke-oneclick': '1' });
  // 避免電小二／Bootstrap modal 的事件委派或 focus trap 搶走面板內的觸控
  host.style.cssText = 'position:relative;z-index:2147483647;isolation:isolate';
  const shadow = host.attachShadow({ mode: 'open' });
  const wrap = h('div', { class: bar ? 'wrap bar' : 'wrap' }, h('div', { class: 'card' }, content));
  // bubble 階段攔截：按鈕已先收到事件；阻止再冒泡到電小二／Bootstrap
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'mousedown', 'mouseup']) {
    wrap.addEventListener(ev, (e) => e.stopPropagation());
  }
  shadow.append(h('style', null, CSS), wrap);
  document.body.appendChild(host);
  return { root: shadow, host, close: () => host.remove() };
}

/**
 * 顯示對話面板並等待按鈕。
 * buttons: [{ label, value, primary }]；回傳被按的 value
 */
export function ask({ title, body = [], buttons }) {
  return new Promise((resolve) => {
    let m;
    const btns = h('div', { class: 'btns' }, buttons.map((b) => h('button', { class: b.primary ? 'pri' : '', type: 'button', onclick: () => { m.close(); resolve(b.value); } }, b.label)));
    m = mount([h('h2', null, title), ...[].concat(body), btns]);
  });
}

export function toast(msg, ms = 3000) {
  const m = mount(h('div', { style: 'white-space:pre-wrap' }, msg), { bar: true });
  setTimeout(m.close, ms);
  return m;
}

export async function copyText(text) {
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
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}
