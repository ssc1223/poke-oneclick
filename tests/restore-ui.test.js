// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { confirmIssues, buildChoiceButtons } from '../src/bookmarklet/restore-ui.js';

const panels = () => [...document.querySelectorAll('[data-poke-oneclick]')].map((h) => h.shadowRoot);
const findBtn = (text) => panels().flatMap((r) => [...r.querySelectorAll('button')]).find((b) => b.textContent.includes(text));
const choiceBtns = () => panels().flatMap((r) => [...r.querySelectorAll('button.choice')]);

afterEach(() => {
  document.querySelectorAll('[data-poke-oneclick]').forEach((e) => e.remove());
});

describe('buildChoiceButtons', () => {
  it('預設選第一個建議，點擊可改選並更新 aria-pressed', () => {
    const picks = {};
    const issue = {
      kind: 'item-renamed',
      item: '麥茶',
      suggestions: [{ name: '冰麥茶', score: 0.9 }],
      choices: ['冰麥茶', '檸檬汁', '綠茶'],
    };
    const el = buildChoiceButtons(issue, 0, picks);
    document.body.appendChild(el);
    expect(picks[0]).toBe('冰麥茶');
    expect(el.querySelector('[aria-pressed="true"]').textContent).toContain('冰麥茶');

    el.querySelector('[data-choice="檸檬汁"]').click();
    expect(picks[0]).toBe('檸檬汁');
    expect(el.querySelector('[aria-pressed="true"]').dataset.choice).toBe('檸檬汁');

    el.querySelector('[data-choice="__skip__"]').click();
    expect(picks[0]).toBe('');
  });
});

describe('confirmIssues 按鈕列表', () => {
  it('點替代按鈕再按「用建議替代」會帶回 picks', async () => {
    const issues = [{
      kind: 'item-renamed',
      item: '麥茶',
      suggestions: [{ name: '冰麥茶', score: 0.9 }],
      choices: ['冰麥茶', '檸檬汁'],
    }];
    const done = confirmIssues(issues, 'menu');
    // 等面板掛上
    await Promise.resolve();
    expect(findBtn('用建議替代')).toBeTruthy();
    expect(choiceBtns().some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);

    findBtn('改用：檸檬汁').click();
    findBtn('用建議替代').click();
    await expect(done).resolves.toEqual({ mode: 'replace', picks: { 0: '檸檬汁' } });
  });

  it('沒有建議時預設略過，仍可用按鈕手動挑', async () => {
    const issues = [{
      kind: 'item-missing',
      item: '神秘品項',
      suggestions: [],
      choices: ['麥茶', '檸檬汁'],
    }];
    const done = confirmIssues(issues, 'menu');
    await Promise.resolve();
    expect(findBtn('這項略過').getAttribute('aria-pressed')).toBe('true');
    findBtn('改用：麥茶').click();
    findBtn('用建議替代').click();
    await expect(done).resolves.toEqual({ mode: 'replace', picks: { 0: '麥茶' } });
  });
});
