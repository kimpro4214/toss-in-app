import { expect, test } from '@playwright/test';

test('배너 한 개를 탭 전환 시 유지하고 입력 화면에서는 정리해요', async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { initialized: 0, attached: 0, destroyed: 0 };
    const host = window as any; host.bannerStats = stats;
    host.__appsInToss = { ads: {
      initialize: Object.assign(({ callbacks }: any) => { stats.initialized++; callbacks.onInitialized(); }, { isSupported: () => true }),
      attachBanner: (_id: string, target: HTMLElement, { callbacks }: any) => {
        stats.attached++;
        const content = document.createElement('div'); content.textContent = 'Ad · 테스트 배너'; content.style.height = '96px'; target.append(content);
        host.noBannerFill = () => callbacks.onNoFill({ slotId: 'test', adGroupId: 'test', adMetadata: {} });
        return { destroy: () => { stats.destroyed++; content.remove(); } };
      },
    } };
  });
  await page.goto('/');
  const banner = page.getByRole('complementary', { name: '광고', exact: true });
  await expect(banner).toBeVisible();
  for (const name of ['내 서재', '달력', '오늘']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(banner).toHaveCount(1);
  }
  expect(await page.evaluate(() => (window as any).bannerStats)).toEqual({ initialized: 1, attached: 1, destroyed: 0 });
  await page.getByRole('button', { name: '책 추가', exact: true }).click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).bannerStats.destroyed)).toBe(1);
  await page.getByRole('button', { name: '직접 입력', exact: true }).click();
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('배너와 함께 읽는 책');
  await page.getByRole('button', { name: '내 서재에 담기', exact: true }).click();
  await expect(banner).toBeVisible();
  expect(await page.evaluate(() => (window as any).bannerStats.initialized)).toBe(1);
  for (const width of [320, 390, 520]) {
    await page.setViewportSize({ width, height: 844 });
    await banner.scrollIntoViewIfNeeded();
    const bounds = await banner.boundingBox();
    const nav = await page.getByRole('navigation', { name: '주 메뉴' }).boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'reports/banner-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await page.getByRole('textbox', { name: '어디까지 읽었나요?', exact: true }).fill('12');
  await page.evaluate(() => (window as any).noBannerFill());
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '어디까지 읽었나요?', exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: '책갈피 남기기', exact: true }).click();
  await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('12쪽');
  await page.getByRole('button', { name: '독서 타이머 시작' }).click();
  await expect(page.getByRole('timer', { name: '독서 측정 시간' })).toBeVisible();
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(page.getByRole('button', { name: '이어서 측정', exact: true })).toBeVisible();
});

test('배너 미지원 브라우저에서도 책 추가와 기록을 사용할 수 있어요', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: '광고', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '읽고 있는 책 추가하기', exact: true }).click();
  await page.getByRole('button', { name: '직접 입력', exact: true }).click();
  await page.getByRole('textbox', { name: '책 제목', exact: true }).fill('광고 없이 읽는 책');
  await page.getByRole('button', { name: '내 서재에 담기', exact: true }).click();
  await page.getByRole('textbox', { name: '어디까지 읽었나요?', exact: true }).fill('10');
  await page.getByRole('button', { name: '책갈피 남기기', exact: true }).click();
  await expect(page.getByRole('status', { name: '독서 기록 저장 결과' })).toContainText('10쪽');
});
