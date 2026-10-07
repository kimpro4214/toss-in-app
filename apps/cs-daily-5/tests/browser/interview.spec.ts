import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Question } from '../../src/types';

const key = 'cs-daily-5:v1:browser';
const questions = JSON.parse(readFileSync(new URL('../../src/courses/game-client-14.json', import.meta.url), 'utf8')).questions as Question[];
async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '선택 초기화', exact: true }).click();
  await page.getByRole('checkbox', { name: 'C++', exact: true }).check();
  await page.getByRole('button', { name: '선택한 과목으로 시작하기', exact: true }).click();
}
async function selectCourse(page: Page) {
  await page.getByRole('button', { name: /14일 게임 클라이언트 면접 준비/ }).click();
  await page.getByRole('button', { name: '면접 코스로 학습하기', exact: true }).click();
}
test('면접 질문·꼬리질문과 5문제 퀴즈·저장·결과·복습', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await page.getByRole('button', { name: /14일 게임 클라이언트 면접 준비/ }).click();
  await expect(page.getByRole('heading', { name: '14일 게임 클라이언트 면접 준비', exact: true })).toBeVisible();
  await expect(page.locator('.course-day')).toHaveCount(14);
  await page.getByRole('button', { name: '말로 연습하기', exact: true }).first().click();
  await expect(page.locator('.oral-question')).toHaveCount(5);
  const oral = page.locator('.oral-question').first();
  await expect(oral.getByRole('heading', { name: '면접 답변의 핵심', exact: true })).not.toBeVisible();
  await oral.locator('summary').first().click();
  await expect(oral.getByRole('heading', { name: '면접 답변의 핵심', exact: true })).toBeVisible();
  await oral.getByText('꼬리질문 · 참조를 사용하면 댕글링 문제가 사라질까요?', { exact: true }).click();
  await expect(oral.getByText(/참조 대상이 먼저 소멸/)).toBeVisible();
  await page.screenshot({ path: 'test-results/interview-oral.png', fullPage: true });
  await page.getByRole('button', { name: '14일 코스 목록으로', exact: true }).click();
  await page.getByRole('button', { name: '면접 코스로 학습하기', exact: true }).click();
  await page.getByRole('button', { name: '오늘의 5문제 시작', exact: true }).click();
  for (let i = 0; i < 5; i++) {
    const id = await page.locator('.question-view').getAttribute('data-question-id');
    expect(id).toBe(`interview-game-client-01-${i + 1}`);
    const q = questions.find(q => q.id === id)!;
    await page.locator('.choice').nth(q.choices.findIndex(c => i === 0 ? c.id !== q.correctChoiceId : c.id === q.correctChoiceId)).click();
    await page.getByRole('button', { name: '답 제출', exact: true }).click();
    await expect(page.getByRole('heading', { name: '면접 답변의 핵심', exact: true })).toBeVisible();
    if (i === 0) {
      await page.screenshot({ path: 'test-results/interview-quiz.png', fullPage: true });
      await page.reload();
      await page.getByRole('button', { name: /이어서 풀기/ }).click();
    } else await page.getByRole('button', { name: i === 4 ? '학습 결과 보기' : '다음 문제', exact: true }).click();
  }
  await expect(page.locator('.course-result')).toContainText('1/14일');
  await expect(page.locator('.score-ring b')).toHaveText('4');
  await page.screenshot({ path: 'test-results/interview-result.png', fullPage: true });
  const before = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  await page.getByRole('button', { name: '오답 복습하기', exact: true }).click();
  await page.locator('.review-row').first().click();
  await page.locator('.choice').nth(questions[0].choices.findIndex(c => c.id === questions[0].correctChoiceId)).click();
  await page.getByRole('button', { name: '답 제출', exact: true }).click();
  const after = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(after.sessions[0].answers).toEqual(before.sessions[0].answers);
  expect(after.firstAnswers).toEqual(before.firstAnswers);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('일반 세트 시작 뒤 코스 선택은 기존 문제·답을 유지한다', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '오늘의 5문제 시작', exact: true }).click();
  const firstId = await page.locator('.question-view').getAttribute('data-question-id');
  await page.locator('.choice').first().click();
  await page.getByRole('button', { name: '답 제출', exact: true }).click();
  const before = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).sessions[0], key);
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await selectCourse(page);
  await page.getByRole('button', { name: /이어서 풀기/ }).click();
  const resumedId = await page.locator('.question-view').getAttribute('data-question-id');
  expect(resumedId).not.toBe(firstId);
  expect(resumedId).not.toMatch(/^interview-/);
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).sessions[0], key)).toEqual(before);
});
test('다음 날짜에 미완료 코스를 복원하고 지원하지 않는 코스 기록은 덮어쓰지 않는다', async ({ page }) => {
  await setup(page); await selectCourse(page);
  await page.getByRole('button', { name: '오늘의 5문제 시작', exact: true }).click();
  await page.locator('.choice').first().click(); await page.getByRole('button', { name: '답 제출', exact: true }).click();
  await page.evaluate(k => { const state = JSON.parse(localStorage.getItem(k)!); state.sessions[0].date = '2000-01-01'; state.sessions[0].id = 'daily:2000-01-01'; localStorage.setItem(k, JSON.stringify(state)); }, key);
  await page.reload(); await page.getByRole('button', { name: '오늘의 5문제 시작', exact: true }).click();
  await expect(page.locator('.question-view')).toHaveAttribute('data-question-id', 'interview-game-client-01-2');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).sessions.length, key)).toBe(1);
  await page.evaluate(k => { const state = JSON.parse(localStorage.getItem(k)!); state.settings.courseId = 'unknown-course'; localStorage.setItem(k, JSON.stringify(state)); }, key);
  await page.reload(); await expect(page.getByRole('alert')).toContainText('기존 기록은 덮어쓰지 않았습니다');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).settings.courseId, key)).toBe('unknown-course');
});
