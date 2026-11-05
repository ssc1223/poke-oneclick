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
  <h2>這個工具怎麼運作？</h2>
  <ol class="flow">
    <li><b>「存餐點」書籤</b>：在電小二點餐頁開始記錄，你（或朋友）照平常點完，按浮動的「完成並儲存」並取名，再匯入這個 App。</li>
    <li><b>這個 App</b>：管理多組「常點組合」，可改名、刪除、分享給朋友。</li>
    <li><b>「一鍵點餐」書籤</b>：在 App 按「去點餐」後，到電小二點餐頁執行這個書籤，它會自動幫你點選並加入購物車。</li>
  </ol>
  <p class="note">🔒 書籤只會在你的頁面上模擬點選「加入購物車」，<b>不會自動結帳、不會呼叫任何下單 API</b>。最後一定由你自己檢查購物車並結帳。</p>
</section>

<section class="card warn" id="line">
  <h2>⚠ 不要在 LINE 裡面開點餐網址</h2>
  <p>LINE 的內建瀏覽器不能使用書籤。收到點餐連結後請改用手機預設瀏覽器開啟：</p>
  <ul>
    <li><b>Android</b>：在 LINE 開啟連結後，點右上角 ${ic.dots} →「使用預設瀏覽器開啟」（確認預設瀏覽器是 Chrome）。</li>
    <li><b>iPhone</b>：在 LINE 開啟連結後，點右下角 ${ic.share} 或「⋯」→「在 Safari 中開啟」。</li>
    <li>也可以長按連結 →「複製」，再貼到 Chrome／Safari 的網址列。</li>
    <li>想一勞永逸：LINE「設定」→「LINE Labs」→ 開啟「使用預設瀏覽器開啟連結」（Android 版有此選項）。</li>
  </ul>
</section>

<section class="card" id="code">
  <h2>步驟 1：複製書籤程式碼</h2>
  <p>按下面的按鈕複製，下一步要貼到書籤的「網址」欄位。一次只能複製一個，請兩個書籤分別做一次。</p>
  <div class="bm">
    <div><b>① 存餐點</b><span class="mut">（${bm.save.length.toLocaleString()} 字）</span></div>
    <button class="btn pri" data-copy="save">複製「存餐點」程式碼</button>
  </div>
  <div class="bm">
    <div><b>② 一鍵點餐</b><span class="mut">（${bm.restore.length.toLocaleString()} 字）</span></div>
    <button class="btn pri" data-copy="restore">複製「一鍵點餐」程式碼</button>
  </div>
  <details>
    <summary>用電腦？直接拖曳到書籤列</summary>
    <p>把下面兩個連結拖到瀏覽器的書籤列即可：
      <a class="drag" data-bm="save" href="#">存餐點</a>
      <a class="drag" data-bm="restore" href="#">一鍵點餐</a></p>
  </details>
</section>

<section class="card" id="android">
  <h2>步驟 2（Android Chrome）：新增書籤</h2>
  <ol class="steps">
    <li>
      <p>在 Chrome 開任何網頁（例如這一頁），點右上角 ${ic.dots}，再點上方的 ${ic.star} 加入書籤。</p>
      ${phone(url('ssc1223.github.io', hl(ic.dots)), `<div class="ph-menu">${hl(ic.star)} ⬇ ⓘ ↻<div>新分頁</div><div>書籤</div><div>記錄</div></div>`)}
    </li>
    <li>
      <p>點 ${ic.dots} →「書籤」→ 找到剛剛加的書籤，<b>長按</b> →「編輯」。</p>
      ${phone(url('書籤'), `<div class="ph-list"><div>${hl('波奇一鍵點餐 ← 長按')}</div><div>行動版書籤</div></div>`)}
    </li>
    <li>
      <p>名稱改成 <code>存餐點</code>；<b>網址整個刪掉</b>，貼上剛剛複製的程式碼（開頭是 <code>javascript:</code>），按返回鍵儲存。</p>
      ${phone(url('編輯書籤'), `<div class="ph-form"><label>名稱</label><div class="ph-input">存餐點</div><label>網址</label><div class="ph-input">${hl('javascript:(()=>{…')}</div></div>`)}
    </li>
    <li><p>回到步驟 1 複製「一鍵點餐」，同樣方法再建一個名稱為 <code>一鍵點餐</code> 的書籤。</p></li>
  </ol>
  <h3>怎麼執行書籤（Android）</h3>
  <p>在電小二點餐頁點<b>網址列</b>，輸入 <code>存餐點</code> 或 <code>一鍵點餐</code>，在下方建議清單中點<b>有星號 ${ic.star} 的那一項</b>（就是書籤）。直接從書籤清單點開在 Android 上通常無效。</p>
  ${phone(url(hl('一鍵點餐')), `<div class="ph-list"><div>${hl(ic.star + ' 一鍵點餐　javascript:…')}</div><div>🔍 一鍵點餐 - Google 搜尋</div></div>`)}
</section>

<section class="card" id="ios">
  <h2>步驟 2（iPhone Safari）：新增書籤</h2>
  <ol class="steps">
    <li>
      <p>用 Safari 開任何網頁（例如這一頁），點下方（或網址列旁）的分享 ${ic.share} →「加入書籤」→ 儲存。</p>
      ${phone(url('ssc1223.github.io'), `<div class="ph-list"><div>拷貝</div><div>${hl('加入書籤')}</div><div>加入主畫面</div></div>`, `‹ › ${hl(ic.share)} ${ic.book} ▢`)}
    </li>
    <li>
      <p>點書籤圖示 ${ic.book} → 右下「編輯」→ 點剛剛加的書籤。</p>
      ${phone(url('書籤'), `<div class="ph-list"><div>${hl('波奇一鍵點餐 ›')}</div><div>喜好項目</div></div>`, `<span style="margin-left:auto">${hl('編輯')}</span>`)}
    </li>
    <li>
      <p>標題改成 <code>存餐點</code>；點網址欄，<b>刪掉原本的網址</b>，長按 →「貼上」程式碼，按「完成」。</p>
      ${phone(url('編輯書籤'), `<div class="ph-form"><div class="ph-input">存餐點</div><div class="ph-input">${hl('javascript:(()=>{…')}</div></div>`)}
    </li>
    <li><p>回到步驟 1 複製「一鍵點餐」，同樣方法再建一個名稱為 <code>一鍵點餐</code> 的書籤。</p></li>
  </ol>
  <h3>怎麼執行書籤（iPhone）</h3>
  <p>在電小二點餐頁點網址列，輸入 <code>一鍵點餐</code>，點建議清單中「書籤與喜好項目」下的那一項；或點 ${ic.book} 從書籤清單點選。</p>
  <p class="note">iPhone 讀取剪貼簿時，可能會跳出「貼上」的小按鈕，請點它同意。如果沒有出現，書籤會跳出輸入框，長按 →「貼上」即可。</p>
</section>

<section class="card" id="pwa">
  <h2>把這個 App 加到主畫面</h2>
  <ul>
    <li><b>iPhone Safari</b>：點分享 ${ic.share} → 往下滑 →「加入主畫面」${ic.plus} →「新增」。</li>
    <li><b>Android Chrome</b>：點 ${ic.dots} →「加到主畫面」或「安裝應用程式」→「安裝」。</li>
  </ul>
  <p class="note">從主畫面開 App 後按「去點餐」時，點餐頁可能會開在 App 內的小視窗，那裡不能用書籤。請點小視窗選單裡的「在 Chrome 中開啟」，iPhone 請改用 Safari 開啟點餐網址（資料已在剪貼簿裡）。</p>
</section>

<section class="card">
  <h2>使用流程</h2>
  <ol>
    <li><b>記錄</b>：開點餐頁 → 執行「存餐點」→ 照平常點餐、按「加入購物車」（右上角會顯示已記住幾份）→ 按「完成並儲存」並取名 →「匯入到 App」。</li>
    <li><b>點餐</b>：在 App 選一組 →「去點餐」（資料會複製到剪貼簿）→ 開點餐頁 → 執行「一鍵點餐」。</li>
    <li>如果店家改了菜單、賣完或價格變動，會先跳出提示，讓你選「略過繼續」、「用建議替代」或「取消」。</li>
    <li>完成後<b>自己檢查購物車再結帳</b>。</li>
  </ol>
</section>`;
}
