// 把 seed/menu-summary.txt 轉成 mock/menu-data.json（本地模擬菜單用）
import { readFileSync, writeFileSync } from 'node:fs';
const txt = readFileSync(new URL('../seed/menu-summary.txt', import.meta.url), 'utf8');
const cats = [];
let cat, item;
for (const line of txt.split('\n')) {
  let m;
  if ((m = line.match(/^## (.+)$/))) cats.push((cat = { title: m[1].trim(), items: [] }));
  else if ((m = line.match(/^- (.+?) \$(\d+)\s*$/))) cat.items.push((item = { name: m[1], price: +m[2], groups: [] }));
  else if ((m = line.match(/^\s+\[(.+?)\] 選(\d+)~(\d+): (.+)$/))) {
    item.groups.push({
      title: m[1], min: +m[2], max: +m[3],
      options: m[4].split(', ').map((o) => {
        const p = o.match(/^(.*)\(\+(\d+)\)$/);
        return p ? { name: p[1], price: +p[2] } : { name: o, price: 0 };
      }),
    });
  }
}
writeFileSync(new URL('../mock/menu-data.json', import.meta.url), JSON.stringify(cats, null, 1));
console.log(cats.map((c) => c.title + ':' + c.items.length).join(' '));
