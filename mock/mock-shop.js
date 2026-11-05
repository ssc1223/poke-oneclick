// 本地模擬的電小二點餐頁（只用來測試書籤，DOM 結構對應真實網站 shop.cashier.tw 實測到的樣子）
// 不會連到任何真實網站。和真實網站一致的重點：
//  - 卡片的價格與熱量是相鄰的 <div>$20</div><div>3.7 大卡</div>（textContent 會黏成「$203.7 大卡」）
//  - 選項加價是獨立的 <div class="px-2 fw-bolder">$65</div>（沒有 + 號），後面緊接熱量
//  - 加點用的數量是 <input type=number>
//  - 頁面上另有隱藏的 .modal 與隱藏的 [data-testid=attributeCTALayout]，只有 .modal.show 是目前視窗

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param {Document} doc
 * @param {Array} cats  mock/menu-data.json 的內容
 * @param {object} mods 模擬菜單變動：
 *   rename: { 舊名: 新名 }, soldOut: [品項], price: { 品項: 新價格 }, remove: [品項],
 *   optionSoldOut: [[品項, 群組, 選項]], optionRemove: [[品項, 群組, 選項]], optionRename: [[品項, 群組, 舊, 新]],
 *   groupRename: [[品項, 舊群組, 新群組]], announcement: boolean,
 *   addOnFormat: 'plus' 改用舊版「+$45」加價格式（預設和真實網站一樣是「$65」）
 */
// 依名稱產生固定的假熱量（例如「120.5」），讓每次 DOM 都一樣
const fakeKcal = (name) => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return `${(h % 400) + 10}.${h % 10}`;
};

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
        <div style="font-size: var(--web-text-md)">${esc(it.name)}</div><div class="d-flex"><div class="fw-bold">$${it.price}</div><div class="text-muted">${it.kcal != null ? it.kcal : fakeKcal(it.name)} 大卡</div></div>${it.soldOut ? '<span class="tag">已售完</span>' : ''}
      </div>`).join('')}`).join('')}
    </div>
    <div class="sticky-footer" style="display:none"><button type="button" data-testid="attributeCTALayout">加入購物車</button></div>
    <div class="modal fade" id="hiddenModal" style="display:none"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">隱藏的舊視窗</h5></div>
      <div class="modal-body"><div class="group"><div class="hdr"><div class="attribute-category-title">隱藏群組</div></div><div class="opts">
        <div class="px-3"><label><input type="checkbox" checked><span class="attribute-option-title">隱藏選項</span></label><div class="px-2 fw-bolder">$999</div></div>
      </div></div></div>
      <div class="modal-footer">
        <textarea data-testid="comment">隱藏備註</textarea>
        <div class="qty"><button type="button" data-testid="attributeQuantityEditor-minus">－</button><span data-testid="attributeQuantityEditor-edit">9</span><button type="button" data-testid="attributeQuantityEditor-add">＋</button></div>
        <button type="button" data-testid="attributeCTALayout">加入購物車</button>
      </div>
    </div></div></div>
    <div class="cartbar"><span id="cartCount">購物車 0 件</span><button type="button" id="checkout">前往結帳</button></div>
    <div class="modal fade" id="itemModal" style="display:none"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">數量編輯</h5><button type="button" class="btn-close" aria-label="Close">×</button></div>
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

  const modal = doc.getElementById('itemModal');
  const mBody = modal.querySelector('.modal-body');
  const qtyEl = modal.querySelector('[data-testid=attributeQuantityEditor-edit]');
  const comment = modal.querySelector('textarea');
  const errEl = modal.querySelector('.err');
  let cur = null; // { it, qty, comment, sel: Map<group, Map<option, n>> }

  const backdropId = 'mockModalBackdrop';
  const removeBackdrop = () => { const bd = doc.getElementById(backdropId); if (bd) bd.remove(); };
  const ensureBackdrop = () => {
    if (doc.getElementById(backdropId)) return;
    const bd = doc.createElement('div');
    bd.id = backdropId;
    bd.className = 'modal-backdrop fade show';
    bd.style.cssText = 'position:fixed;inset:0;z-index:1040;background:#000;opacity:.5';
    // 真實 Bootstrap：點 backdrop 通常會關視窗
    bd.addEventListener('click', close);
    doc.body.appendChild(bd);
  };
  const close = () => {
    modal.style.display = 'none';
    modal.className = 'modal fade';
    cur = null;
    removeBackdrop();
  };
  modal.querySelector('.btn-close').addEventListener('click', close);
  // 模擬 React：用 input 事件同步狀態
  comment.addEventListener('input', () => { if (cur) cur.comment = comment.value; });
  modal.querySelector('[data-testid=attributeQuantityEditor-add]').addEventListener('click', () => { cur.qty++; qtyEl.textContent = cur.qty; });
  modal.querySelector('[data-testid=attributeQuantityEditor-minus]').addEventListener('click', () => { if (cur.qty > 1) cur.qty--; qtyEl.textContent = cur.qty; });

  const total = (g) => [...cur.sel.get(g.title).values()].reduce((a, b) => a + b, 0);

  function open(it) {
    if (ann && ann.isConnected) return; // 公告沒關掉時點不到
    cur = { it, qty: 1, comment: '', sel: new Map() };
    // 真實電小二：header 固定「數量編輯」，品名在 body 大字（不是 .modal-title）
    modal.querySelector('.modal-title').textContent = '數量編輯';
    qtyEl.textContent = '1';
    comment.value = '';
    errEl.textContent = '';
    // 結構對齊真實電小二：圖片 → web-text-2xl 品名 → 熱量（textContent 會黏成「品名90.2 大卡」）
    const kcal = it.kcal != null ? it.kcal : fakeKcal(it.name);
    mBody.innerHTML = `
      <div class="d-flex justify-content-center"><div style="background-image:url(about:blank);width:72px;height:72px;background-size:cover"></div></div>
      <div class="w-100 "><div class="px-3 mt-2"><div></div></div>
        <div class="web-text-2xl py-0 px-3 fw-bolder">${esc(it.name)}</div>
        <div class="web-text-md pb-3 px-3" style="color:#6c757d">${kcal} 大卡</div></div>
      <div class="w-100 border-top border-bottom"></div>`;
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
        const addOn = o.price ? (mods.addOnFormat === 'plus' ? `<span class="add">+$${o.price}</span>` : `<div class="px-2 fw-bolder">$${o.price}</div>`) : '';
        const extra = `${addOn}<div class="text-muted">${fakeKcal(o.name)} 大卡</div>${o.soldOut ? '<span class="tag">已售完</span>' : ''}`;
        sel.set(o.name, fixed ? 1 : 0);
        if (counter) {
          row.innerHTML = `<div><div><span class="attribute-option-title">${esc(o.name)}</span></div></div>${extra}
            <button type="button" data-testid="quantityCounter-minus-${gi}-${oi}">－</button><input type="number" min="0" value="0" data-testid="quantityCounter-edit-${gi}-${oi}"><button type="button" data-testid="quantityCounter-plus-${gi}-${oi}"${o.soldOut ? ' disabled' : ''}>＋</button>`;
          const edit = row.querySelector('[data-testid^=quantityCounter-edit]');
          row.querySelector('[data-testid^=quantityCounter-plus]').addEventListener('click', () => {
            if (o.soldOut || total(g) >= g.max) return;
            sel.set(o.name, sel.get(o.name) + 1); edit.value = sel.get(o.name);
          });
          row.querySelector('[data-testid^=quantityCounter-minus]').addEventListener('click', () => {
            if (sel.get(o.name) > 0) sel.set(o.name, sel.get(o.name) - 1); edit.value = sel.get(o.name);
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
    modal.style.zIndex = '1055';
    modal.className = 'modal fade show';
    ensureBackdrop();
  }

  body.querySelectorAll('[data-testid^="menuItems-item"]').forEach((card) => {
    card.addEventListener('click', () => {
      // 真實電小二：.modal.show 開著時點不到後面的菜單（被 backdrop 擋住）
      if (modal.classList.contains('show')) return;
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
