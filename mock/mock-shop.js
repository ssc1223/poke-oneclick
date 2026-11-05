// 本地模擬的電小二點餐頁（只用來測試書籤，DOM 結構對應 seed 驗證過的選擇器）
// 不會連到任何真實網站。

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param {Document} doc
 * @param {Array} cats  mock/menu-data.json 的內容
 * @param {object} mods 模擬菜單變動：
 *   rename: { 舊名: 新名 }, soldOut: [品項], price: { 品項: 新價格 }, remove: [品項],
 *   optionSoldOut: [[品項, 群組, 選項]], optionRemove: [[品項, 群組, 選項]], optionRename: [[品項, 群組, 舊, 新]],
 *   groupRename: [[品項, 舊群組, 新群組]], announcement: boolean
 */
export function mountMockShop(doc, cats, mods = {}) {
  const state = { cart: [], checkoutClicked: false, errors: [] };
  const menu = JSON.parse(JSON.stringify(cats));
  for (const c of menu) {
    c.items = c.items.filter((it) => !(mods.remove || []).includes(it.name));
    for (const it of c.items) {
      const orig = it.name;
      if (mods.rename && mods.rename[orig]) it.name = mods.rename[orig];
      if (mods.price && mods.price[orig] != null) it.price = mods.price[orig];
      it.soldOut = (mods.soldOut || []).includes(orig);
      for (const g of it.groups) {
        for (const [i, gt, ng] of mods.groupRename || []) if (i === orig && gt === g.title) g.title = ng;
        g.options = g.options.filter((o) => !(mods.optionRemove || []).some(([i, gt, on]) => i === orig && gt === g.title && on === o.name));
        for (const o of g.options) {
          o.soldOut = (mods.optionSoldOut || []).some(([i, gt, on]) => i === orig && gt === g.title && on === o.name);
          for (const [i, gt, on, nn] of mods.optionRename || []) if (i === orig && gt === g.title && on === o.name) o.name = nn;
        }
      }
    }
  }

  const body = doc.body;
  body.innerHTML = `
    ${mods.announcement !== false ? '<div id="ann" class="ann"><p>公告：本店營業時間調整</p><button type="button">我知道了</button></div>' : ''}
    <div id="menu">${menu.map((c, ci) => `<h3>${esc(c.title)}</h3>${c.items.map((it, ii) => `
      <div data-testid="menuItems-item-${ci}-${ii}" class="card${it.soldOut ? ' disabled' : ''}" data-ci="${ci}" data-ii="${ii}">
        <div style="font-size: var(--web-text-md)">${esc(it.name)}</div>
        <div class="price">$${it.price}</div>${it.soldOut ? '<span class="tag">已售完</span>' : ''}
      </div>`).join('')}`).join('')}
    </div>
    <div class="cartbar"><span id="cartCount">購物車 0 件</span><button type="button" id="checkout">前往結帳</button></div>
    <div class="modal" style="display:none"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" aria-label="Close">×</button></div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <textarea data-testid="comment" placeholder="備註"></textarea>
        <div class="qty"><button type="button" data-testid="attributeQuantityEditor-minus">－</button><span data-testid="attributeQuantityEditor-edit">1</span><button type="button" data-testid="attributeQuantityEditor-add">＋</button></div>
        <p class="err"></p>
        <button type="button" data-testid="attributeCTALayout">加入購物車</button>
      </div>
    </div></div></div>`;

  const ann = doc.getElementById('ann');
  if (ann) ann.querySelector('button').addEventListener('click', () => ann.remove());
  doc.getElementById('checkout').addEventListener('click', () => { state.checkoutClicked = true; });

  const modal = body.querySelector('.modal');
  const mBody = modal.querySelector('.modal-body');
  const qtyEl = modal.querySelector('[data-testid=attributeQuantityEditor-edit]');
  const comment = modal.querySelector('textarea');
  const errEl = modal.querySelector('.err');
  let cur = null; // { it, qty, comment, sel: Map<group, Map<option, n>> }

  const close = () => { modal.style.display = 'none'; modal.className = 'modal'; cur = null; };
  modal.querySelector('.btn-close').addEventListener('click', close);
  // 模擬 React：用 input 事件同步狀態
  comment.addEventListener('input', () => { if (cur) cur.comment = comment.value; });
  modal.querySelector('[data-testid=attributeQuantityEditor-add]').addEventListener('click', () => { cur.qty++; qtyEl.textContent = cur.qty; });
  modal.querySelector('[data-testid=attributeQuantityEditor-minus]').addEventListener('click', () => { if (cur.qty > 1) cur.qty--; qtyEl.textContent = cur.qty; });

  const total = (g) => [...cur.sel.get(g.title).values()].reduce((a, b) => a + b, 0);

  function open(it) {
    if (ann && ann.isConnected) return; // 公告沒關掉時點不到
    cur = { it, qty: 1, comment: '', sel: new Map() };
    modal.querySelector('.modal-title').textContent = it.name;
    qtyEl.textContent = '1';
    comment.value = '';
    errEl.textContent = '';
    mBody.innerHTML = '';
    it.groups.forEach((g, gi) => {
      const sel = new Map();
      cur.sel.set(g.title, sel);
      const counter = /^加點/.test(g.title);
      const radio = !counter && g.min === 1 && g.max === 1;
      const fixed = !counter && !radio && g.min === g.max && g.max === g.options.length;
      const wrap = doc.createElement('div');
      wrap.className = 'group';
      wrap.innerHTML = `<div class="hdr"><div class="attribute-category-title">${esc(g.title)}</div><small>選 ${g.min}~${g.max}</small></div><div class="opts"></div>`;
      const optsEl = wrap.querySelector('.opts');
      g.options.forEach((o, oi) => {
        const row = doc.createElement('div');
        row.className = 'px-3';
        const extra = `${o.price ? `<span class="add">+$${o.price}</span>` : ''}${o.soldOut ? '<span class="tag">已售完</span>' : ''}`;
        sel.set(o.name, fixed ? 1 : 0);
        if (counter) {
          row.innerHTML = `<div><div><span class="attribute-option-title">${esc(o.name)}</span></div></div>${extra}
            <button type="button" data-testid="quantityCounter-minus-${gi}-${oi}">－</button><span data-testid="quantityCounter-edit-${gi}-${oi}">0</span><button type="button" data-testid="quantityCounter-plus-${gi}-${oi}"${o.soldOut ? ' disabled' : ''}>＋</button>`;
          const edit = row.querySelector('[data-testid^=quantityCounter-edit]');
          row.querySelector('[data-testid^=quantityCounter-plus]').addEventListener('click', () => {
            if (o.soldOut || total(g) >= g.max) return;
            sel.set(o.name, sel.get(o.name) + 1); edit.textContent = sel.get(o.name);
          });
          row.querySelector('[data-testid^=quantityCounter-minus]').addEventListener('click', () => {
            if (sel.get(o.name) > 0) sel.set(o.name, sel.get(o.name) - 1); edit.textContent = sel.get(o.name);
          });
        } else {
          row.innerHTML = `<label><input type="${radio ? 'radio' : 'checkbox'}" name="g${gi}"${fixed ? ' checked' : ''}${o.soldOut ? ' disabled' : ''}><span class="attribute-option-title">${esc(o.name)}</span></label>${extra}`;
          const input = row.querySelector('input');
          input.addEventListener('click', (e) => {
            if (!radio && input.checked && total(g) >= g.max) { e.preventDefault(); return; }
            if (radio) for (const k of sel.keys()) sel.set(k, 0);
            sel.set(o.name, input.checked ? 1 : 0);
          });
        }
        optsEl.appendChild(row);
      });
      mBody.appendChild(wrap);
    });
    modal.style.display = 'block';
    modal.className = 'modal show';
  }

  body.querySelectorAll('[data-testid^="menuItems-item"]').forEach((card) => {
    card.addEventListener('click', () => {
      const it = menu[card.dataset.ci].items[card.dataset.ii];
      if (!it.soldOut) open(it);
    });
  });

  modal.querySelector('[data-testid=attributeCTALayout]').addEventListener('click', () => {
    if (!cur) return;
    const bad = cur.it.groups.filter((g) => total(g) < g.min || total(g) > g.max);
    if (bad.length) {
      errEl.textContent = '請完成必選項：' + bad.map((g) => g.title).join('、');
      state.errors.push(errEl.textContent);
      return;
    }
    const options = {};
    for (const [g, m] of cur.sel) {
      const arr = [];
      for (const [o, n] of m) for (let k = 0; k < n; k++) arr.push(o.replace(/\s+/g, ' ').trim());
      options[g] = arr;
    }
    state.cart.push({ item: cur.it.name, qty: cur.qty, comment: cur.comment, options });
    doc.getElementById('cartCount').textContent = `購物車 ${state.cart.length} 件`;
    close();
  });

  return state;
}
