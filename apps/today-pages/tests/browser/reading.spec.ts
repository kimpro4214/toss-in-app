import { test, expect, type Page } from '@playwright/test';
import { readFile, copyFile } from 'node:fs/promises';

const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format();
const key = 'today-pages:v1:browser';
async function addManual(page: Page, title = '느리게 읽는 즐거움', start = '42', startedOn?: string) {
  await page.getByRole('button', { name: '책 추가', exact: true }).click();
  await page.getByRole('button', { name: '직접 입력', exact: true }).click();
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill(title);
  await page.getByRole('textbox', { name: '저자 (선택)', exact: true }).fill('김독서');
  await page.getByRole('textbox', { name: '전체 쪽수 (선택)', exact: true }).fill('100');
  await page.getByRole('textbox', { name: '이미 읽은 페이지', exact: true }).fill(start);
  if (startedOn) await page.getByLabel('읽기 시작일', { exact: true }).fill(startedOn);
  await page.getByRole('button', { name: '내 서재에 담기', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '어디까지 읽었나요?', exact: true })).toBeVisible();
}
async function log(page: Page, value: string) {
  await page.getByRole('textbox', { name: '어디까지 읽었나요?', exact: true }).fill(value);
  await page.getByRole('button', { name: '책갈피 남기기', exact: true }).click();
}
test('한 권 기록·중복 갱신·완독·PNG·백업·복원', async ({ page }) => {
  await page.goto('/'); await addManual(page); await log(page, '57');
  await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('오늘 15쪽 읽었어요');
  await log(page, '65'); await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('오늘 23쪽 읽었어요');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'reports/today-mobile.png', fullPage: true });
  const saveBounds = await page.getByRole('button', { name: '책갈피 남기기', exact: true }).boundingBox();
  expect(saveBounds!.y + saveBounds!.height).toBeLessThan(844 - 79);
  await page.getByRole('button', { name: '느리게 읽는 즐거움', exact: true }).click();
  await page.getByRole('textbox', { name: '완독 감상', exact: true }).fill('한 장씩 읽으니 끝까지 왔다.');
  await page.getByRole('button', { name: '완독 남기기', exact: true }).click();
  await page.getByRole('button', { name: '완독 남기기', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: '완독을 축하해요.' })).toBeVisible();
  const pngWait = page.waitForEvent('download'); await page.getByRole('button', { name: '완독 카드 PNG 저장' }).click();
  const png = await pngWait; expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngPath = await png.path(); const image = await readFile(pngPath!);
  expect(image.readUInt32BE(16)).toBe(1080); expect(image.readUInt32BE(20)).toBe(1350);
  await copyFile(pngPath!, 'reports/completion-card.png');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const jsonWait = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSON 백업 파일 저장', exact: true }).click();
  const download = await jsonWait; const file = await download.path(); expect(file).toBeTruthy();
  await page.getByRole('button', { name: '전체 기록 삭제', exact: true }).click();
  await page.getByRole('button', { name: '전체 삭제', exact: true }).click();
  await expect(page.getByRole('button', { name: '읽고 있는 책 추가하기' })).toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('JSON 백업 파일 선택', { exact: true }).setInputFiles(file!);
  await expect(page.getByText('복원할 내용: 책 1권 · 회차 1개 · 기록 1개')).toBeVisible();
  const safetyBackup = page.waitForEvent('download'); await page.getByRole('button', { name: '현재 기록 백업 후 복원 준비' }).click(); await safetyBackup;
  await page.getByRole('button', { name: '기록 교체', exact: true }).click();
  await page.getByRole('button', { name: '내 서재', exact: true }).click();
  await page.getByRole('button', { name: /^완독/ }).click();
  await page.getByRole('button', { name: /느리게 읽는 즐거움/ }).click();
  await expect(page.getByText('한 장씩 읽으니 끝까지 왔다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '처음부터 다시 읽기' }).click();
  await expect(page.locator('.page-count strong')).toHaveText('0');
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key);
  expect(stored.rounds).toHaveLength(2); expect(stored.entries).toHaveLength(1);
  await page.screenshot({ path: 'reports/reading-mobile.png', fullPage: true });
});

test('검색 등록·여러 책 전환·재실행·오프라인 기록·모바일 폭', async ({ page }) => {
  await page.route('**/api/books?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    if (query === '실패') { await route.fulfill({ status: 502, json: { message: '검색 연결 실패' } }); return; }
    await route.fulfill({ json: { books: [{ title: '검색한 책', authors: ['작가'], isbn: '9781234567890', sourceUrl: 'https://search.daum.net/book' }], hasMore: false } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '책 추가', exact: true }).click();
  await page.getByRole('textbox', { name: '제목·저자·ISBN 검색' }).fill('검색');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: /검색한 책 작가/ }).click();
  await page.getByRole('button', { name: '내 서재에 담기', exact: true }).click();
  await addManual(page, '두 번째 책', '0');
  await page.getByRole('button', { name: '검색한 책', exact: true }).first().click();
  await log(page, '12');
  await page.reload(); await expect(page.locator('.book-info h2')).toHaveText('검색한 책');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.context().setOffline(true); await log(page, '15');
  await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('15쪽');
  await page.context().setOffline(false);
  for (const width of [320, 390, 520]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});

test('저장 실패 후 입력 유지와 재시도·기록 수정·손상된 복원 차단', async ({ page }) => {
  await page.goto('/'); await addManual(page);
  await page.evaluate(() => { const original = Storage.prototype.setItem; let fail = true; Storage.prototype.setItem = function(k, v) { if (k.startsWith('today-pages') && fail) { fail = false; throw new DOMException('저장 공간 부족', 'QuotaExceededError'); } original.call(this, k, v); }; });
  await log(page, '57'); await expect(page.getByRole('alert')).toContainText('저장 공간 부족');
  await expect(page.getByRole('textbox', { name: '어디까지 읽었나요?' })).toHaveValue('57');
  await page.getByRole('button', { name: '책갈피 남기기', exact: true }).click(); await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('15쪽');
  await page.getByRole('button', { name: '느리게 읽는 즐거움', exact: true }).click();
  await page.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('textbox', { name: '어디까지 읽었나요?' }).fill('52');
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await expect(page.locator('.entry .section-head b')).toHaveText('+10쪽');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const before = await page.evaluate(k => localStorage.getItem(k), key);
  await page.getByRole('textbox', { name: '백업 JSON 내용', exact: true }).fill('{broken');
  await page.getByRole('button', { name: '복원 내용 확인' }).click(); await expect(page.getByRole('alert')).toContainText('읽을 수 없어요');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(before);
});

test('손상된 저장 데이터를 초기화하지 않는다', async ({ page }) => {
  await page.addInitScript(k => localStorage.setItem(k, '{broken'), key);
  await page.goto('/'); await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken');
});

test('과거 날짜 입력·앞뒤 분량 재계산·중단과 재시작·작성 중 기록 보존', async ({ page }) => {
  const past = new Date(`${date}T00:00:00Z`); past.setUTCDate(past.getUTCDate() - 1);
  const yesterday = past.toISOString().slice(0, 10);
  await page.goto('/'); await addManual(page, '매일 조금씩', '42', yesterday);
  await page.getByRole('textbox', { name: '어디까지 읽었나요?' }).fill('50');
  await page.locator('.record-options summary').click();
  await page.getByLabel('독서 날짜', { exact: true }).fill(yesterday);
  await page.getByRole('button', { name: '책갈피 남기기', exact: true }).click();
  await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('8쪽');
  await page.getByLabel('독서 날짜', { exact: true }).fill(date); await log(page, '65');
  await page.getByRole('button', { name: '매일 조금씩', exact: true }).click();
  const old = page.locator('.entry').filter({ hasText: yesterday });
  await old.getByRole('button', { name: '기록 수정', exact: true }).click();
  await page.getByRole('textbox', { name: '어디까지 읽었나요?' }).fill('55');
  await page.getByRole('button', { name: '수정 저장', exact: true }).click();
  await expect(old.locator('.section-head b')).toHaveText('+13쪽');
  await expect(page.locator('.entry').filter({ hasText: date }).locator('.section-head b')).toHaveText('+10쪽');
  await page.getByRole('button', { name: '잠시 중단', exact: true }).click();
  await expect(page.getByRole('button', { name: '이어서 읽기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이어서 읽기', exact: true }).click();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await page.getByRole('textbox', { name: '어디까지 읽었나요?' }).fill('70');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '어디까지 읽었나요?' })).toHaveValue('70');
});

test('검색 실패·빈 결과·중복 ISBN에서도 기록을 유지한다', async ({ page }) => {
  await page.route('**/api/books?**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === '실패') { await route.fulfill({ status: 502, json: { message: '검색 연결 실패' } }); return; }
    await route.fulfill({ json: { books: q === '없음' ? [] : [{ title: '같은 책', authors: [], isbn: '9781234567890' }], hasMore: false } });
  });
  await page.goto('/'); await page.getByRole('button', { name: '책 추가', exact: true }).click();
  const search = async (q: string) => { await page.getByRole('textbox', { name: '제목·저자·ISBN 검색' }).fill(q); await page.getByRole('button', { name: '검색', exact: true }).click(); };
  await search('실패'); await expect(page.getByRole('alert')).toContainText('검색 연결 실패');
  await search('없음'); await expect(page.getByText('검색 결과가 없어요.', { exact: false })).toBeVisible();
  await search('같은 책'); await page.getByRole('button', { name: '같은 책', exact: true }).click();
  await page.getByRole('button', { name: '내 서재에 담기', exact: true }).click();
  await page.getByRole('button', { name: '책 추가', exact: true }).click();
  await search('같은 책'); await page.getByRole('button', { name: /같은 책 내 서재에 있어요/ }).click();
  await expect(page.getByRole('heading', { name: '날짜별 책갈피' })).toBeVisible();
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).books.length, key)).toBe(1);
});
