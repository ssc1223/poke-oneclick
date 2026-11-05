# poke-oneclick 波奇一鍵點餐

這是波奇波奇【高雄博愛店】（電小二線上點餐）的一鍵點餐 PWA，搭配**一個**書籤小工具使用。

- **PWA（GitHub Pages）**：管理多組「常點組合」，可以改名、刪除、檢視內容、產生分享連結。點一下餐點卡片就會開啟點餐頁（網址帶 `#coc=`）。可以加到 iOS／Android 主畫面，離線也能開。
- **書籤「一鍵點餐」**（短 loader，300 字以內）：在電小二點餐頁執行時，從 GitHub Pages 載入完整程式（`bookmarklets/oneclick.js?t=時間戳` 避免快取）。之後更新功能不用重裝書籤。按下時自動判斷
  1. 網址有 `#coc=` → 自動還原點餐（先和目前菜單比對，有變動會提示）。
  2. 已記錄到加入購物車的品項 → 存成餐點，直接開啟 App 的 `#import=` 自動匯入，不用再按「匯入」。
  3. 購物車是空的 → 顯示簡單選單（從 App 選餐點／剪貼簿／這個瀏覽器存過的），並在背景開始記錄之後的「加入購物車」。

> 🔒 書籤只會在使用者自己的頁面上模擬點選，**不會呼叫電小二的任何 API，也不會自動結帳**。最後會停在購物車，由使用者自己檢查後結帳。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173/poke-oneclick/
                   # 本地模擬點餐頁：http://localhost:5173/poke-oneclick/mock/index.html
npm test           # Vitest：編碼解碼、比對邏輯、jsdom 模擬頁上的合併書籤
npm run build      # 產生書籤 → vite build → 產生 sw.js（輸出到 dist/）
```

- `src/shared/`：PWA 和書籤共用的程式，包括 `codec.js`（資料格式與 base64url 編碼）和 `compare.js`（菜單比對與相似度）
- `src/bookmarklet/`：書籤原始碼。DOM 操作沿用 `seed/` 中已驗證的選擇器和步驟
- `src/bookmarklet/oneclick.js`：書籤入口；判斷邏輯在 `oneclick-core.js`（純函式），流程在 `oneclick-app.js`
- `scripts/build-bookmarklets.mjs`：用 esbuild 把完整程式輸出成靜態 `bookmarklets/oneclick.js`，並產生 300 字以內的短 `javascript:` loader。環境變數 `POKE_PWA_URL` 可指定 App 網址與腳本載入來源
- `mock/`：本地模擬的電小二頁面，資料來自 `seed/menu-summary.txt`，只用於測試，不會連到真實網站
- `seed/`：原本已驗證過的參考實作

## 資料格式（v1）

```json
{ "v": 1, "app": "poke-oneclick",
  "sets": [{ "id": "…", "name": "小明的鮮魚波奇", "savedAt": "ISO 時間",
    "items": [{ "item": "創意自選波奇", "qty": 1, "comment": "",
      "options": { "基底選一": ["糙米"], "加點蛋白質": ["挪威鮭魚(生)", "挪威鮭魚(生)"] },
      "price": 125, "optPrices": { "加點蛋白質": { "挪威鮭魚(生)": 65 } } }] }] }
```

傳遞時會把 JSON 轉成 UTF-8，再做 base64url 編碼，放在 `#import=`（開啟 App 時自動匯入）或 `#coc=`（給書籤自動點餐）。同一個選項出現兩次代表數量 2。也可以讀取 seed 舊版的 `{savedAt, items}` 格式。
