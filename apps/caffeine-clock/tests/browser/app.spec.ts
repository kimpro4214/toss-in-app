import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initialState } from '../../src/engine';
const key = 'caffeine-clock:v1:browser';
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
async function start(page: Page) { await page.goto('/'); await expect(page.getByRole('heading', { name: '내 카페인의 흐름' })).toBeVisible(); }
async function search(page: Page, name: string) { await page.getByRole('button', { name: '음료 찾기', exact: true }).click(); await page.getByRole('textbox', { name: '음료 검색' }).fill(name); }
async function customRecord(page: Page, name = '직접 만든 커피') {
  await search(page, '없는메뉴'); await page.getByRole('button', { name: '찾는 음료가 없나요? 직접 입력' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('음료 이름').fill(name); await dialog.getByLabel('마신 양 (mL)').fill('250'); await dialog.getByLabel('총 카페인 (mg)').fill('100');
  return dialog;
}
test('음료 비교는 저장하지 않으며 즐겨찾기→기록→수정→삭제', async ({ page }) => {
  await start(page); await search(page, '아메리카노 250'); await page.getByText('아메리카노 250mL', { exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByText(/미리보기는 저장되지/)).toBeVisible(); expect(await stored(page)).toBeNull();
  await dialog.getByRole('button', { name: '☆ 즐겨찾기 추가', exact: true }).click(); expect((await stored(page)).records).toHaveLength(0);
  await dialog.getByRole('button', { name: '마셨다면 기록하기' }).click(); await dialog.getByRole('button', { name: '기록 저장', exact: true }).click(); await expect(dialog).not.toBeVisible();
  expect((await stored(page)).records[0].caffeineMg).toBe(80);
  await page.reload(); await expect(page.getByText('오늘의 한 잔,')).toBeVisible();
  await page.getByRole('button', { name: '기록', exact: true }).click(); await page.getByRole('button', { name: '아메리카노 수정', exact: true }).click();
  await page.getByRole('dialog').getByLabel('총 카페인 (mg)').fill('50'); await page.getByRole('button', { name: '수정 저장' }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await stored(page)).records[0].caffeineMg).toBe(50); expect((await stored(page)).records[0].sourceUrl).toBeNull();
  await page.getByRole('button', { name: '아메리카노 삭제', exact: true }).click(); await page.getByRole('button', { name: '기록 삭제', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); expect((await stored(page)).records).toHaveLength(0);
});
test('물 기록·선택 참고량·설정 변경이 기존 기록을 보존', async ({ page }) => {
  await start(page); await page.getByRole('button', { name: '250mL', exact: true }).click(); await page.getByRole('button', { name: '기록 저장', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click(); await page.getByLabel('목표 설정 방식').selectOption('reference'); await page.getByLabel('연령대 (선택 입력)').selectOption('65-74'); await page.getByLabel('참고표의 성별 기준 (선택 입력)').selectOption('female'); await page.getByLabel('목표 취침 시각').fill('01:00'); await page.getByRole('button', { name: '설정 저장' }).click();
  await expect(page.getByText('설정을 저장했어요. 기존 기록은 그대로 유지돼요.')).toBeVisible();
  expect((await stored(page)).records).toHaveLength(1); await page.getByRole('button', { name: '오늘', exact: true }).click(); await expect(page.getByText('/ 목표 900mL', { exact: true })).toBeVisible(); await expect(page.getByText('물 250mL', { exact: true })).toBeVisible();
});
test('저장 실패 후 입력 보존·재시도와 중복 저장 방지', async ({ page }) => {
  await start(page); const dialog = await customRecord(page);
  await page.evaluate(() => { const original = Storage.prototype.setItem; let first = true; Storage.prototype.setItem = function(key, value) { if (key.startsWith('caffeine-clock') && first) { first = false; throw Error('저장 테스트 실패'); } return original.call(this, key, value); }; });
  await dialog.getByRole('button', { name: '기록 저장' }).click(); await expect(dialog.getByRole('alert')).toHaveText('저장 테스트 실패'); await expect(dialog.getByLabel('음료 이름')).toHaveValue('직접 만든 커피'); expect(await stored(page)).toBeNull();
  await dialog.getByRole('button', { name: '기록 저장' }).click(); await expect(dialog).not.toBeVisible(); expect((await stored(page)).records).toHaveLength(1);
});
test('백업 내보내기·검증·교체 복원·전체 삭제', async ({ page }) => {
  await start(page); const dialog = await customRecord(page); await dialog.getByRole('button', { name: '기록 저장' }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click(); const wait = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSON 백업 내보내기' }).click(); const download = await wait; expect(download.suggestedFilename()).toMatch(/\.json$/); const file = await download.path();
  await page.getByRole('button', { name: '기록과 설정 전체 삭제' }).click(); await page.getByRole('button', { name: '전체 삭제', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); expect((await stored(page)).records).toHaveLength(0);
  await page.getByRole('button', { name: '설정', exact: true }).click(); await page.getByLabel('백업 파일 선택').setInputFiles(file!); await expect(page.getByRole('dialog')).toContainText('검증된 기록 1건'); await page.getByRole('button', { name: '백업으로 교체', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); expect((await stored(page)).records).toHaveLength(1);
});
test('잘못된 백업과 손상된 저장자료를 덮어쓰지 않음', async ({ page }) => {
  await start(page); await page.getByRole('button', { name: '설정', exact: true }).click(); await page.getByText('백업 내용 붙여넣기로 복원', { exact: true }).click(); await page.getByLabel('복원할 JSON').fill('{"version":2}'); await page.getByRole('button', { name: '백업 검증 후 복원' }).click(); await expect(page.getByRole('alert')).toContainText('지원하는'); expect(await stored(page)).toBeNull();
  await page.evaluate(key => localStorage.setItem(key, 'broken'), key); await page.reload(); await expect(page.getByRole('alert')).toContainText('JSON'); expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('broken');
});
test('일반 참고값의 가정과 용량 변경·반 잔 기록', async ({ page }) => {
  await start(page); await search(page, '아메리카노 250'); await page.getByText('아메리카노 250mL', { exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/추출 방식·샷 수에 따라/)).toBeVisible(); await dialog.getByText('이 참고값의 계산 기준', { exact: true }).click(); await expect(dialog.getByText(/에스프레소 60mL당/)).toBeVisible();
  await dialog.getByLabel('다른 음료와 비교').selectOption('americano-500'); await expect(dialog.getByLabel('총 카페인 (mg)')).toHaveValue('80'); await expect(dialog.getByLabel('마실 양 (mL)')).toHaveValue('500');
  await dialog.getByRole('button', { name: '반 잔', exact: true }).click(); await expect(dialog.getByLabel('총 카페인 (mg)')).toHaveValue('40');
  await dialog.getByLabel('마실 양 (mL)').fill('300'); await expect(dialog.getByLabel('총 카페인 (mg)')).toHaveValue('40'); await dialog.getByRole('button', { name: '마셨다면 기록하기' }).click(); await dialog.getByRole('button', { name: '기록 저장' }).click(); await expect(dialog).not.toBeVisible(); expect((await stored(page)).records[0]).toMatchObject({ name: '아메리카노', caffeineMg: 40, volumeMl: 300 });
});
test('목록에서 사라진 음료의 기존 기록과 백업 호환 유지', async ({ page }) => {
  const state = initialState(); state.favorites = ['removed-catalog-item']; state.records.push({ id: 'legacy', variantId: 'removed-catalog-item', name: '이전에 남긴 커피', kind: 'coffee', caffeineMg: 164, volumeMl: 400, volumeEstimated: true, consumedAt: new Date(Date.now() - 3600000).toISOString(), sourceUrl: 'https://example.com/old-source', sourceCheckedAt: '2026-01-01' });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await start(page); await page.getByRole('button', { name: '기록', exact: true }).click(); await expect(page.getByRole('heading', { name: '이전에 남긴 커피' })).toBeVisible(); expect((await stored(page)).records[0].caffeineMg).toBe(164);
});
test('백그라운드 복귀 시 실제 경과시간으로 재계산', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T04:00:00Z') });
  const state = initialState(); state.records.push({ id: 'old', variantId: null, name: '아침 커피', kind: 'coffee', caffeineMg: 100, volumeMl: 250, volumeEstimated: false, consumedAt: '2026-10-16T23:00:00Z', sourceUrl: null, sourceCheckedAt: null });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state }); await start(page);
  await expect(page.locator('.caffeine-stats>div').first()).toContainText('50mg');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.setSystemTime(new Date('2026-10-17T09:00:00Z'));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('.caffeine-stats>div').first()).toContainText('25mg');
});
test('30초 갱신 사이 분이 바뀌어도 새 기록은 즉시 계산', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T03:59:59Z') }); await start(page);
  const dialog = await customRecord(page);
  await page.clock.setSystemTime(new Date('2026-10-17T04:00:01Z'));
  await dialog.getByLabel('마신 시각').fill('2026-10-17T13:00');
  await dialog.getByRole('button', { name: '기록 저장' }).click(); await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '오늘', exact: true }).click(); await expect(page.locator('.caffeine-stats>div').first()).toContainText('100mg');
});
test('320px 화면·모달·키보드와 기본 화면 이미지', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.setViewportSize({ width: 320, height: 740 }); await start(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '아메리카노로 먼저 체험하기' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await search(page, '아메리카노'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '오늘', exact: true }).click(); await mkdir('reports', { recursive: true }); await page.locator('button:focus').evaluateAll(elements => elements.forEach(e => (e as HTMLElement).blur())); await page.screenshot({ path: 'reports/today.png', fullPage: true }); await page.getByRole('button', { name: '음료 찾기', exact: true }).click(); await page.screenshot({ path: 'reports/search.png', fullPage: true });
  await page.getByRole('textbox', { name: '음료 검색' }).fill('아메리카노 250'); await page.getByText('아메리카노 250mL', { exact: true }).click(); await page.screenshot({ path: 'reports/compare.png' }); await page.keyboard.press('Escape');
  await page.evaluate(key => { const at = Date.now(); localStorage.setItem(key, JSON.stringify({ version: 1, preferences: { bedtime: '23:00', halfLifeHours: 5, cutoffHours: 9, ageBand: '19-29', referenceSex: 'male', waterGoalMode: 'reference', customWaterGoalMl: null }, favorites: ['americano-250'], records: [{ id: 'demo-coffee', variantId: 'americano-250', name: '아메리카노', kind: 'coffee', caffeineMg: 80, volumeMl: 250, volumeEstimated: false, consumedAt: new Date(at - 3 * 3600000).toISOString(), sourceUrl: 'https://www.efsa.europa.eu/en/topics/topic/caffeine', sourceCheckedAt: '2026-10-17' }, { id: 'demo-water', variantId: null, name: '물', kind: 'water', caffeineMg: 0, volumeMl: 500, volumeEstimated: false, consumedAt: new Date(at - 3600000).toISOString(), sourceUrl: null, sourceCheckedAt: null }] })); }, key);
  await page.reload(); await expect(page.getByText('오늘의 한 잔,')).toBeVisible(); await page.screenshot({ path: 'reports/today-recorded.png', fullPage: true }); expect(errors).toEqual([]);
});
