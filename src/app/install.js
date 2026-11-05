// 安裝教學頁（繁體中文圖文說明）

const ic = {
  share: '<svg viewBox="0 0 24 24" class="ic" aria-label="分享"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6v10h12V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" class="ic" aria-label="書籤"><path d="M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0zM20 5c-3-1.5-5.5-1.5-8 0v15c2.5-1.5 5-1.5 8 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  dots: '<svg viewBox="0 0 24 24" class="ic" aria-label="選單"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="ic" aria-label="星號"><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="ic" aria-label="加入"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** 簡單的手機畫面示意圖 */
const phone = (bar, body, bottom = '') => `
<div class="phone" aria-hidden="true">
  <div class="ph-bar">${bar}</div>
  <div class="ph-body">${body}</div>
  ${bottom ? `<div class="ph-bottom">${bottom}</div>` : ''}
</div>`;
const url = (t, extra = '') => `<span class="ph-url">${t}</span>${extra}`;
const hl = (x) => `<span class="ph-hl">${x}</span>`;

export function installHtml(bm) {
  return `
<section class="card">
  <h2>只要設定一個書籤</h2>
  <p>書籤「一鍵點餐」會自己判斷要做什麼：</p>
  <ul class="flow">
    <li><b>存餐點</b>：在點餐頁按書籤 → 照平常「加入購物車」→ 再按一次書籤，餐點就自動存進這個 App。</li>
    <li><b>點餐</b>：在 App 點一下餐點卡片開啟點餐頁 → 按書籤，就會自動加入購物車（菜單有變動會先提示你）。</li>
  </ul>
  <p class="note">🔒 書籤只會模擬點選「加入購物車」，<b>不會自動結帳</b>。最後一定由你自己檢查購物車並結帳。</p>
</section>

<section class="card" id="code">
  <h2>步驟 1：複製書籤程式碼</h2>
  <button class="btn pri block" data-copy="oneclick">一鍵複製書籤程式碼</button>
  <p class="mut">（${bm.oneclick.length.toLocaleString()} 字，開頭是 <code>javascript:</code>）</p>
  <details>
    <summary>用電腦？直接把這個連結拖到書籤列</summary>
    <p><a class="drag" href="#">一鍵點餐</a></p>
  </details>
</section>

<section class="card" id="add">
  <h2>步驟 2：新增書籤並貼上</h2>
  <p>把這一頁加入書籤，再編輯它：名稱改成 <code>一鍵點餐</code>，<b>網址整個刪掉後貼上</b>剛剛複製的程式碼，儲存。</p>
  <ul>
    <li><b>Android Chrome</b>：${ic.dots} → ${ic.star} 加入書籤 → ${ic.dots}「書籤」→ 長按該書籤 →「編輯」。</li>
    <li><b>iPhone Safari</b>：分享 ${ic.share} →「加入書籤」→ ${ic.book} →「編輯」→ 點該書籤。</li>
  </ul>
  ${phone(url('編輯書籤'), `<div class="ph-form"><label>名稱</label><div class="ph-input">一鍵點餐</div><label>網址</label><div class="ph-input">${hl('javascript:(()=>{…')}</div></div>`)}
</section>

<section class="card" id="use">
  <h2>步驟 3：在點餐頁執行書籤</h2>
  <p>在電小二點餐頁點<b>網址列</b>，輸入 <code>一鍵點餐</code>，點建議清單中的書籤（Android 是有星號 ${ic.star} 的那項；iPhone 也可以從 ${ic.book} 書籤清單點）。</p>
  ${phone(url(hl('一鍵點餐')), `<div class="ph-list"><div>${hl(ic.star + ' 一鍵點餐　javascript:…')}</div><div>🔍 一鍵點餐 - Google 搜尋</div></div>`)}
</section>

<details class="card" id="line">
  <summary><b>⚠ 在 LINE 裡打開點餐網址？</b></summary>
  <p>LINE 的內建瀏覽器不能使用書籤，請改用 Chrome／Safari 開啟：Android 點右上 ${ic.dots} →「使用預設瀏覽器開啟」；iPhone 點 ${ic.share} 或「⋯」→「在 Safari 中開啟」。</p>
</details>

<details class="card" id="pwa">
  <summary><b>把這個 App 加到主畫面</b></summary>
  <ul>
    <li><b>iPhone Safari</b>：分享 ${ic.share} →「加入主畫面」${ic.plus}。</li>
    <li><b>Android Chrome</b>：${ic.dots} →「加到主畫面」或「安裝應用程式」。</li>
  </ul>
  <p class="note">從主畫面開 App 時，點餐頁可能會開在 App 內的小視窗，那裡不能用書籤。請點選單的「在 Chrome 中開啟」，iPhone 請改用 Safari 開啟。</p>
</details>`;
}
