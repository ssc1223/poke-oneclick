// 紀錄 vs. 目前菜單的比對邏輯（純函式，不碰 DOM；PWA 測試與書籤共用）
//
// menu:   [{ name, price?, soldOut? }]
// issue:  { kind, ..., suggestions: [{ name, score }]（依相似度）, choices?: [名稱]（所有可替代的項目，給使用者手動挑）}
// groups: [{ title, options: [{ name, price?, soldOut? }] }]

/** 與 seed 相同的比對方式：只收斂空白 */
export const normName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const sameName = (a, b) => normName(a) === normName(b);

/** 相似度用的鍵：全形轉半形、去掉加價標記、括號符號與空白 */
export function simKey(s) {
  return normName(s)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/\(\s*\+\s*\$?\d+\s*\)/g, '')
    .replace(/[\s()[\]{}【】「」『』〔〕<>《》/／、,.。:：\-_~·•]/g, '');
}

function bigrams(s) {
  const arr = [...s];
  if (arr.length < 2) return arr;
  const out = [];
  for (let i = 0; i < arr.length - 1; i++) out.push(arr[i] + arr[i + 1]);
  return out;
}

/** 0~1 的名稱相似度（bigram Dice 係數＋包含關係加分） */
export function similarity(a, b) {
  const x = simKey(a);
  const y = simKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x);
  const by = bigrams(y);
  const pool = new Map();
  for (const g of by) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0;
  for (const g of bx) {
    const n = pool.get(g);
    if (n) {
      hit++;
      pool.set(g, n - 1);
    }
  }
  let score = (2 * hit) / (bx.length + by.length);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (long.includes(short)) score = Math.max(score, 0.6 + 0.4 * (short.length / long.length));
  return Math.min(score, 0.99);
}

export function suggest(name, candidates, { limit = 3, min = 0.3 } = {}) {
  const seen = new Set();
  return candidates
    .filter((c) => {
      const k = normName(c);
      if (!k || seen.has(k) || k === normName(name)) return false;
      seen.add(k);
      return true;
    })
    .map((c) => ({ name: normName(c), score: similarity(name, c) }))
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const RENAME_THRESHOLD = 0.6;
export const GROUP_THRESHOLD = 0.5;

/** 品項層級比對：下架／改名／售完／價格變動 */
export function compareItems(items, menu) {
  const issues = [];
  const available = menu.filter((m) => !m.soldOut).map((m) => m.name);
  items.forEach((it, index) => {
    const m = menu.find((x) => sameName(x.name, it.item));
    if (!m) {
      const suggestions = suggest(it.item, available);
      const kind = suggestions[0] && suggestions[0].score >= RENAME_THRESHOLD ? 'item-renamed' : 'item-missing';
      issues.push({ kind, index, item: it.item, suggestions, choices: available });
      return;
    }
    if (m.soldOut) {
      issues.push({ kind: 'item-soldout', index, item: it.item, suggestions: suggest(it.item, available), choices: available.filter((n) => !sameName(n, it.item)) });
      return;
    }
    if (typeof it.price === 'number' && typeof m.price === 'number' && it.price !== m.price) {
      issues.push({ kind: 'item-price', index, item: it.item, from: it.price, to: m.price, suggestions: [] });
    }
  });
  return issues;
}

/** 選項層級比對：群組不見、選項不見、選項售完、加價變動 */
export function compareOptions(item, groups) {
  const issues = [];
  const titles = groups.map((g) => g.title);
  for (const [gt, wants] of Object.entries(item.options || {})) {
    if (!wants || !wants.length) continue;
    let target = groups.find((g) => sameName(g.title, gt));
    if (!target) {
      const suggestions = suggest(gt, titles);
      issues.push({ kind: 'group-missing', item: item.item, group: gt, suggestions, choices: titles });
      target = suggestions[0] && suggestions[0].score >= GROUP_THRESHOLD ? groups.find((g) => sameName(g.title, suggestions[0].name)) : null;
      if (!target) continue;
    }
    const available = target.options.filter((o) => !o.soldOut).map((o) => o.name);
    for (const w of [...new Set(wants.map(normName))]) {
      const o = target.options.find((x) => sameName(x.name, w));
      const base = { item: item.item, group: gt, targetGroup: target.title, option: w };
      if (!o) {
        issues.push({ kind: 'option-missing', ...base, suggestions: suggest(w, available), choices: available });
      } else if (o.soldOut) {
        issues.push({ kind: 'option-soldout', ...base, suggestions: suggest(w, available), choices: available });
      } else {
        const rec = item.optPrices && item.optPrices[gt] && item.optPrices[gt][w];
        const cur = typeof o.price === 'number' ? o.price : 0;
        if (typeof rec === 'number' && rec !== cur) {
          issues.push({ kind: 'option-price', ...base, from: rec, to: cur, suggestions: [] });
        }
      }
    }
  }
  return issues;
}

/** 這個問題能不能用「建議替代」處理（有相似建議） */
export const replaceable = (is) => !/price$/.test(is.kind) && !!(is.suggestions && is.suggestions.length);
/** 這個問題能不能讓使用者手動挑替代（有建議或有其他可選項目） */
export const choosable = (is) => !/price$/.test(is.kind) && !!((is.suggestions && is.suggestions.length) || (is.choices && is.choices.length));

function pickFor(issue, k, picks) {
  if (picks && Object.prototype.hasOwnProperty.call(picks, k)) return picks[k] || null; // '' 或 null = 這項略過
  return issue.suggestions && issue.suggestions[0] ? issue.suggestions[0].name : null;
}

/**
 * 依使用者選擇處理品項層級問題。
 * mode: 'skip'（有問題的品項略過）| 'replace'（有建議就替代，沒有就略過）
 * picks: { [issue 索引]: 使用者在下拉選單選的替代名稱 }
 */
export function resolveItems(items, issues, mode, picks) {
  const out = items.map((x) => ({ ...x }));
  const drop = new Set();
  issues.forEach((is, k) => {
    if (is.kind === 'item-price') return;
    const to = mode === 'replace' ? pickFor(is, k, picks) : null;
    if (to) {
      out[is.index] = { ...out[is.index], item: to };
      delete out[is.index].price;
      delete out[is.index].optPrices;
    } else drop.add(is.index);
  });
  return { items: out.filter((_, i) => !drop.has(i)), skipped: items.filter((_, i) => drop.has(i)) };
}

/** 依使用者選擇處理選項層級問題，回傳新的 item（不修改原物件） */
export function resolveOptions(item, issues, mode, picks) {
  const opts = {};
  for (const [g, list] of Object.entries(item.options || {})) opts[g] = list.map(normName);
  const groupMoves = [];
  issues.forEach((is, k) => {
    if (/price$/.test(is.kind)) return;
    const to = mode === 'replace' ? pickFor(is, k, picks) : null;
    if (is.kind === 'group-missing') {
      groupMoves.push([is.group, to]);
      return;
    }
    const list = opts[is.group] || [];
    opts[is.group] = to ? list.map((x) => (x === is.option ? to : x)) : list.filter((x) => x !== is.option);
  });
  for (const [from, to] of groupMoves) {
    const list = opts[from];
    delete opts[from];
    if (to && list) opts[to] = list;
  }
  return { ...item, options: opts };
}

export function describeIssue(is) {
  switch (is.kind) {
    case 'item-missing':
      return `「${is.item}」菜單上找不到（可能已下架）`;
    case 'item-renamed':
      return `「${is.item}」找不到，可能改名為「${is.suggestions[0].name}」`;
    case 'item-soldout':
      return `「${is.item}」目前售完`;
    case 'item-price':
      return `「${is.item}」價格變動：$${is.from} → $${is.to}`;
    case 'group-missing':
      return `「${is.item}」的選項群組「${is.group}」不見了`;
    case 'option-missing':
      return `「${is.group}」裡的「${is.option}」不見了`;
    case 'option-soldout':
      return `「${is.group}」裡的「${is.option}」已售完`;
    case 'option-price':
      return `「${is.group}」的「${is.option}」加價變動：+${is.from} → +${is.to}`;
    default:
      return '未知的變動';
  }
}
