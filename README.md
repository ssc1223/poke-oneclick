# poke-oneclick 波奇一鍵點餐

這是波奇波奇【高雄博愛店】（電小二線上點餐）的一鍵點餐 PWA，搭配兩個書籤小工具使用。

- **PWA（GitHub Pages）**：管理多組「常點組合」，可以改名、刪除、檢視內容、產生分享連結，也有「去點餐」功能。可以加到 iOS／Android 主畫面，離線也能開。
- **書籤①「存餐點」**：在電小二點餐頁開始記錄。之後每按一次「加入購物車」就記下一份。按浮動的「完成並儲存」取名後，可以匯入 App。
- **書籤②「一鍵點餐」**：依序從網址 `#coc=`、剪貼簿、貼上框或本站 localStorage 讀取資料，先和目前的菜單比對，再自動點選並加入購物車。

> 🔒 書籤只會在使用者自己的頁面上模擬點選，**不會呼叫電小二的任何 API，也不會自動結帳**。最後會停在購物車，由使用者自己檢查後結帳。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173/poke-oneclick/
                   # 本地模擬點餐頁：http://localhost:5173/poke-oneclick/mock/index.html
npm test           # Vitest：編碼解碼、比對邏輯、jsdom 模擬頁上的存餐點／一鍵點餐
npm run build      # 產生書籤 → vite build → 產生 sw.js（輸出到 dist/）
```

- `src/shared/`：PWA 和書籤共用的程式，包括 `codec.js`（資料格式與 base64url 編碼）和 `compare.js`（菜單比對與相似度）
- `src/bookmarklet/`：書籤原始碼。DOM 操作沿用 `seed/` 中已驗證的選擇器和步驟
- `scripts/build-bookmarklets.mjs`：用 esbuild 把書籤打包成 `javascript:` 網址（做法同 `seed/build.py`）。環境變數 `POKE_PWA_URL` 可以指定「匯入到 App」要開的網址
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

傳遞時會把 JSON 轉成 UTF-8，再做 base64url 編碼，放在 `#import=`（匯入 App）或 `#coc=`（給一鍵點餐）。同一個選項出現兩次代表數量 2。也可以讀取 seed 舊版的 `{savedAt, items}` 格式。
