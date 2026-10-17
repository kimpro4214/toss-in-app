import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ initialize: Object.assign(vi.fn(), { isSupported: vi.fn(() => true) }), attachBanner: Object.assign(vi.fn(), { isSupported: vi.fn(() => true) }), track: vi.fn() }));
vi.mock('@apps-in-toss/web-framework', () => ({ TossAds: mock }));
vi.mock('../src/platform', () => ({ native: true, track: mock.track }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mock.initialize.isSupported.mockReturnValue(true); mock.attachBanner.isSupported.mockReturnValue(true); });
it('여러 마운트에도 초기화 한 번, 화면 해제 시 제거, 실제 이벤트 구분', async () => {
  mock.initialize.mockImplementation(({ callbacks }) => callbacks.onInitialized());
  const destroy = vi.fn(); mock.attachBanner.mockReturnValue({ destroy });
  const { mountBanner } = await import('../src/banner');
  const a = mountBanner({} as HTMLElement, vi.fn()); await Promise.resolve();
  const b = mountBanner({} as HTMLElement, vi.fn()); await Promise.resolve();
  expect(mock.initialize).toHaveBeenCalledTimes(1); expect(mock.attachBanner).toHaveBeenCalledTimes(2);
  const callbacks = mock.attachBanner.mock.calls[0][2].callbacks;
  callbacks.onAdRendered(); callbacks.onAdImpression(); callbacks.onAdViewable();
  expect(mock.track).toHaveBeenCalledWith('banner_viewable'); a(); b(); expect(destroy).toHaveBeenCalledTimes(2);
  mock.track.mockClear(); callbacks.onAdViewable(); expect(mock.track).not.toHaveBeenCalled();
});
it('초기화 완료 전에 나가면 배너를 부착하지 않음', async () => {
  let ready!: () => void; mock.initialize.mockImplementation(({ callbacks }) => { ready = callbacks.onInitialized; });
  const { mountBanner } = await import('../src/banner'); const leave = mountBanner({} as HTMLElement, vi.fn()); leave(); ready(); await Promise.resolve(); expect(mock.attachBanner).not.toHaveBeenCalled();
});
it('광고 없음은 한 번 접고 제거', async () => {
  mock.initialize.mockImplementation(({ callbacks }) => callbacks.onInitialized()); const destroy = vi.fn(); mock.attachBanner.mockReturnValue({ destroy }); const unavailable = vi.fn();
  const { mountBanner } = await import('../src/banner'); const leave = mountBanner({} as HTMLElement, unavailable); await Promise.resolve(); const callbacks = mock.attachBanner.mock.calls[0][2].callbacks; callbacks.onNoFill(); callbacks.onAdFailedToRender(); leave(); expect(unavailable).toHaveBeenCalledTimes(1); expect(destroy).toHaveBeenCalledTimes(1);
});
it('미지원 SDK 및 초기화 실패를 처리', async () => {
  mock.initialize.isSupported.mockReturnValue(false); const unavailable = vi.fn();
  const { mountBanner } = await import('../src/banner'); mountBanner({} as HTMLElement, unavailable); expect(unavailable).toHaveBeenCalledTimes(1); expect(mock.initialize).not.toHaveBeenCalled();
  mock.initialize.isSupported.mockReturnValue(true); mock.initialize.mockImplementation(({ callbacks }) => callbacks.onInitializationFailed(Error('fail'))); mountBanner({} as HTMLElement, unavailable); await Promise.resolve(); await Promise.resolve(); expect(unavailable).toHaveBeenCalledTimes(2);
});
