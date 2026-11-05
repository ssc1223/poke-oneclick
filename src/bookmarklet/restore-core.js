// 「一鍵點餐」核心：比對菜單 → 依序開品項、勾選項、按「加入購物車」。
// 只模擬使用者點選，不呼叫任何 API，也絕對不會按「結帳」。
import {
  norm, rows, rowState, tap, visible, findCard, snapshotMenu, snapshotGroups,
  ackButton, cta, qsModal, numOf, setTextareaValue, modalShowsItem, anyModalOpen, closeModal,
} from './dom.js';
import { compareItems, compareOptions, resolveItems, resolveOptions } from '../shared/compare.js';

export function makeTiming(scale = 1) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * scale));
  const until = async (f, ms) => {
    const t = Date.now();
    const limit = (ms || 8000) * scale;
    while (Date.now() - t < limit) {
      const v = f();
      if (v) return v;
      await sleep(150);
    }
    return f() || null;
  };
  return { sleep, until };
}

/** 依 seed 驗證過的方式設定一個群組：先取消不要的，再勾要的 */
async function applyGroup(groupEl, want, sleep) {
  const rs = rows(groupEl);
  for (const r of rs) {
    const need = want.filter((w) => w === r.title).length;
    const s = rowState(r.el);
    if (s.input) {
      if (s.input.type === 'checkbox' && s.input.checked && !need) { tap(s.input); await sleep(80); }
    } else {
      let guard = 0;
      while (rowState(r.el).n > need && guard++ < 20) { tap(rowState(r.el).minus()); await sleep(80); }
    }
  }
  for (const r of rs) {
    const need = want.filter((w) => w === r.title).length;
    if (!need) continue;
    const s = rowState(r.el);
    if (s.input) {
      if (!s.input.checked) { tap(s.input); await sleep(80); }
    } else {
      let guard = 0;
      while (rowState(r.el).n < need && guard++ < 20) { tap(rowState(r.el).plus); await sleep(80); }
    }
  }
}

/**
 * 關掉執行前就開著（或卡住）的選項視窗。
 * 真實電小二：開著 .modal.show 時點不到後面的菜單卡片；若殘留視窗，
 * 後續會誤判「已打開」、改到錯的視窗，或 CTA 一直看得到而把成功加成失敗。
 */
export async function ensureModalsClosed({ sleep, until }, tries = 3) {
  for (let i = 0; i < tries; i++) {
    if (!anyModalOpen()) return true;
    closeModal();
    await sleep(200);
    const gone = await until(() => !anyModalOpen(), 2500);
    if (gone) return true;
  }
  return !anyModalOpen();
}

/**
 * 執行一鍵點餐。
 * set: { name, items }
 * confirm(issues, stage, item) → Promise<{ mode: 'skip'|'replace'|'cancel', picks }>
 * 回傳 { ok, bad, cancelled }
 */
export async function runRestore(set, { confirm, scale = 1, onProgress } = {}) {
  const { sleep, until } = makeTiming(scale);
  const ok = [];
  const bad = [];

  const menu = snapshotMenu();
  if (!menu.length) {
    return { ok, bad: ['頁面上找不到菜單，請確認是在電小二的點餐頁面'], cancelled: false };
  }
  let items = set.items;
  const itemIssues = compareItems(items, menu);
  if (itemIssues.length) {
    const r = await confirm(itemIssues, 'menu', null);
    if (!r || r.mode === 'cancel') return { ok, bad, cancelled: true };
    const res = resolveItems(items, itemIssues, r.mode, r.picks);
    items = res.items;
    res.skipped.forEach((x) => bad.push(`${x.item}（已略過）`));
  }

  for (let i = 0; i < items.length; i++) {
    let it = items[i];
    onProgress && onProgress(i, items.length, it);
    const ack = ackButton();
    if (ack) { tap(ack); await sleep(400); }

    // 每一份開始前先清掉殘留視窗（含使用者手動先開的）
    const cleared = await ensureModalsClosed({ sleep, until });
    if (!cleared) {
      bad.push(`${it.item}（無法關閉已開啟的選項視窗，請先手動關掉再試）`);
      break;
    }

    const card = findCard(it.item);
    if (!card) { bad.push(`${it.item}（菜單找不到）`); continue; }
    tap(card);
    // 等到 CTA 出現；若讀得到品名則確認是目標項（真實站 .modal-title 是「數量編輯」不是品名）。
    // 比對不到品名時不要判定失敗，只要視窗已開就繼續。
    const opened = await until(() => {
      if (!visible(cta())) return null;
      const shown = modalShowsItem(it.item);
      if (shown === false) return null; // 明確是別的品項（例如殘留視窗）
      return cta();
    });
    if (!opened) { bad.push(`${it.item}（選項視窗沒開）`); continue; }
    await sleep(500);

    let gs = snapshotGroups();
    const optIssues = compareOptions(it, gs);
    if (optIssues.length) {
      const r = await confirm(optIssues, 'options', it);
      if (!r || r.mode === 'cancel') {
        const closed = closeModal();
        await ensureModalsClosed({ sleep, until });
        return { ok, bad, cancelled: true, modalLeftOpen: !closed || anyModalOpen() };
      }
      it = resolveOptions(it, optIssues, r.mode, r.picks);
      gs = snapshotGroups();
    }

    const miss = [];
    for (const gt of Object.keys(it.options || {})) {
      const want = it.options[gt].map(norm);
      const g = gs.find((x) => x.title === norm(gt));
      if (!g) { if (want.length) miss.push(`[${gt}]`); continue; }
      want.forEach((w) => { if (!g.options.some((o) => o.name === w)) miss.push(`${gt}:${w}`); });
      await applyGroup(g.el, want, sleep);
    }

    const qe = qsModal('[data-testid^="attributeQuantityEditor-add"]');
    let g3 = 0;
    while (qe && (numOf(qsModal('[data-testid^="attributeQuantityEditor-edit"]')) || 1) < (it.qty || 1) && g3++ < 20) {
      tap(qe);
      await sleep(100);
    }
    const c = qsModal('textarea[data-testid=comment]');
    if (c && it.comment) setTextareaValue(c, it.comment);

    await sleep(200);
    tap(cta());
    // 以「.modal.show 消失」為準，避免殘留視窗／其他 CTA 造成「已加入卻判失敗」
    const closed = await until(() => !anyModalOpen(), 5000);
    if (!closed) {
      bad.push(`${it.item}（無法加入，可能有必選項沒選到${miss.length ? '：' + miss.join('、') : ''}）`);
      await ensureModalsClosed({ sleep, until });
      break;
    }
    ok.push(`${it.item} x${it.qty || 1}${miss.length ? '（找不到：' + miss.join('、') + '）' : ''}`);
    await sleep(700);
  }
  return { ok, bad, cancelled: false };
}
