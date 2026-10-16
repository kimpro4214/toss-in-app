import { expect, test } from '@playwright/test';

const date = '2026-10-16';
const key = 'today-pages:v1:browser';
const legacy = {
  schemaVersion: 1,
  books: [{ id: 'book', title: '천천히 읽는 책', authors: ['작가'], totalPages: 200 }, { id: 'other', title: '어제와 오늘의 책', authors: [] }],
  rounds: [{ id: 'round', bookId: 'book', startedOn: '2026-10-12', initialPage: 42, status: 'reading', dailyGoal: 10, lastRecordedAt: '2026-10-16T10:00:00Z' }, { id: 'other-round', bookId: 'other', startedOn: '2026-10-12', initialPage: 0, status: 'completed', dailyGoal: 10, completedOn: date, lastRecordedAt: '2026-10-16T09:00:00Z' }],
  entries: [{ id: 'other-entry', roundId: 'other-round', date, page: 13, note: '예전 기록', updatedAt: '2026-10-16T09:00:00Z' }],
  settings: { dailyGoal: 10 },
};
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T10:00:00Z') });
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key, state: legacy });
});

test('타이머 시작·일시정지·재개·저장과 달력의 책별 시간·페이지', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '독서 타이머 시작' }).click();
  await page.clock.fastForward(125000);
  await expect(page.getByRole('timer', { name: '독서 측정 시간' })).toHaveText('00:02:05');
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await page.clock.fastForward(60000);
  await expect(page.getByRole('timer')).toHaveText('00:02:05');
  await page.getByRole('button', { name: '이어서 측정' }).click();
  await page.clock.fastForward(55000);
  await expect(page.getByRole('timer')).toHaveText('00:03:00');
  await page.screenshot({ path: 'reports/timer-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '독서 마치기' }).click();
  await page.getByRole('textbox', { name: '타이머 종료 페이지' }).fill('57');
  await page.getByRole('button', { name: '시간과 페이지 저장' }).click();
  await expect(page.getByRole('status')).toContainText('3분 동안 15쪽');
  const data = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(data.schemaVersion).toBe(2); expect(data.entries.find((e: any) => e.roundId === 'round').readingSeconds).toBe(180); expect(data.timer).toBeNull();
  await page.getByRole('button', { name: '달력', exact: true }).click();
  await expect(page.locator('.eyebrow')).toHaveText('독서 달력');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이번 달 2권, 3분 책을 읽었어요!');
  await page.getByRole('button', { name: '월별 책 보기', exact: true }).click();
  await expect(page.locator('.monthly-books .library-row')).toHaveCount(2);
  await expect(page.locator('.monthly-books')).toContainText('57쪽까지 읽었어요.');
  await expect(page.locator('.monthly-books')).toContainText('13쪽까지 읽었어요.');
  await expect(page.locator('.calendar-grid')).toHaveCount(0);
  await page.screenshot({ path: 'reports/monthly-books-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '달력 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: `${date} 독서 2권`, exact: true })).toBeVisible();
  await expect(page.locator('.calendar-records')).toContainText('천천히 읽는 책');
  await expect(page.locator('.calendar-records')).toContainText('15쪽 · 3분');
  await expect(page.locator('.calendar-records')).toContainText('어제와 오늘의 책');
  await expect(page.locator('.calendar-records')).toContainText('13쪽 · 시간 기록 없음');
  await page.screenshot({ path: 'reports/calendar-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '이전 달' }).click();
  await expect(page.getByRole('heading', { name: '2026년 9월', exact: true })).toBeVisible();
  await expect(page.locator('.calendar-empty')).toBeVisible();
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.locator('.calendar-records')).toContainText('천천히 읽는 책');
  await page.getByRole('button', { name: '2026-10-15 기록 없음', exact: true }).click();
  await page.getByRole('button', { name: '내 서재', exact: true }).click();
  await page.getByRole('button', { name: '달력', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2026.10.15의 독서' })).toBeVisible();
});

test('백그라운드와 새로고침 후에는 측정이 멈추며 시간 중복 없이 이어진다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '독서 타이머 시작' }).click();
  await page.clock.fastForward(65000);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('button', { name: '이어서 측정' })).toBeVisible();
  await page.waitForFunction(k => { const elapsed = JSON.parse(localStorage.getItem(k)!).timer.elapsedMs; return elapsed >= 65000 && elapsed < 66000; }, key);
  await page.clock.fastForward(600000);
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('00:01:05');
  await expect(page.getByRole('button', { name: '이어서 측정' })).toBeVisible();
  await page.getByRole('button', { name: '독서 마치기' }).click();
  await page.getByRole('textbox', { name: '타이머 종료 페이지' }).fill('50');
  await page.getByRole('button', { name: '시간과 페이지 저장' }).click();
  await expect(page.getByRole('status')).toContainText('1분 5초 동안 8쪽');
});

test('확인창은 불투명한 카드와 초록 버튼으로 표시되고 취소 시 기록을 보존한다', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '천천히 읽는 책', exact: true }).click();
  await page.getByRole('button', { name: '완독 남기기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 254, 250)');
  await page.clock.fastForward(1000);
  const action = dialog.getByRole('button', { name: '완독 남기기', exact: true });
  expect(await action.evaluate(el => getComputedStyle(el.children[0]).backgroundColor)).toBe('rgb(47, 107, 79)');
  for (const width of [320, 390, 620]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await dialog.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'reports/confirmation-fixed.png' });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).rounds[0].status, key)).toBe('reading');
  await page.getByRole('button', { name: '내 서재', exact: true }).click();
  await expect(page.getByRole('button', { name: '내 서재', exact: true }).locator('svg[data-icon=book]')).toHaveCount(1);
});
