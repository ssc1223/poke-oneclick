// Playwright 用：把 confirmIssues 掛到 window，方便在真機觸控模擬下點選
import { confirmIssues } from '../../src/bookmarklet/restore-ui.js';

window.runAltPanel = (issues, stage = 'menu', item = { item: '測試品項' }) => {
  const p = confirmIssues(issues, stage, item);
  window.__altResultPromise = p;
  p.then((r) => { window.__altResult = r; });
  return p;
};
