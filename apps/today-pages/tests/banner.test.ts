import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { TossAds } from '@apps-in-toss/web-framework';

vi.mock('@apps-in-toss/web-framework',() => ({ TossAds:{
  initialize:Object.assign(vi.fn(),{ isSupported:vi.fn() }),
  attachBanner:Object.assign(vi.fn(),{ isSupported:vi.fn() }),
} }));
const initialize = vi.mocked(TossAds.initialize), attach = vi.mocked(TossAds.attachBanner);
const target = {} as HTMLElement;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('VITE_BANNER_AD_GROUP_ID','configured-banner-group');
  vi.mocked(TossAds.initialize.isSupported).mockReturnValue(true); vi.mocked(TossAds.attachBanner.isSupported).mockReturnValue(true);
  attach.mockReturnValue({ destroy:vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());

it('초기화 완료 뒤 실제 설정한 ID로 배너를 부착하고 SDK 초기화는 재사용해요',async () => {
  const { mountBanner } = await import('../src/banner');
  const dispose = mountBanner(target,vi.fn()); expect(attach).not.toHaveBeenCalled();
  initialize.mock.calls[0][0].callbacks!.onInitialized!(); await flush();
  expect(attach).toHaveBeenCalledWith('configured-banner-group',target,expect.objectContaining({ variant:'expanded',theme:'light' }));
  const destroy = attach.mock.results[0].value.destroy; dispose(); expect(destroy).toHaveBeenCalledOnce();
  const next = mountBanner(target,vi.fn()); await flush(); expect(initialize).toHaveBeenCalledOnce(); expect(attach).toHaveBeenCalledTimes(2); next();
});
it('초기화 중 화면을 떠나면 늦게 배너를 붙이지 않아요',async () => {
  const { mountBanner } = await import('../src/banner');
  const dispose = mountBanner(target,vi.fn()); dispose(); initialize.mock.calls[0][0].callbacks!.onInitialized!(); await flush();
  expect(attach).not.toHaveBeenCalled();
});
it.each(['missing','unsupported'] as const)('ID 없음·미지원(%s)은 광고를 호출하지 않아요',async reason => {
  const { mountBanner } = await import('../src/banner');
  if (reason === 'missing') vi.stubEnv('VITE_BANNER_AD_GROUP_ID','');
  else vi.mocked(TossAds.initialize.isSupported).mockReturnValue(false);
  const unavailable = vi.fn(); mountBanner(target,unavailable)();
  expect(unavailable).toHaveBeenCalledOnce(); expect(initialize).not.toHaveBeenCalled(); expect(attach).not.toHaveBeenCalled();
});
it('초기화 실패 시 빈 광고 영역을 숨겨요',async () => {
  const { mountBanner } = await import('../src/banner');
  const unavailable = vi.fn(); mountBanner(target,unavailable);
  initialize.mock.calls[0][0].callbacks!.onInitializationFailed!(new Error('network')); await flush();
  expect(unavailable).toHaveBeenCalledOnce(); expect(attach).not.toHaveBeenCalled();
});
it('광고 없음·렌더 실패를 알리고 종료 후 이벤트는 무시해요',async () => {
  const { mountBanner } = await import('../src/banner');
  const unavailable = vi.fn(), dispose = mountBanner(target,unavailable);
  initialize.mock.calls[0][0].callbacks!.onInitialized!(); await flush();
  const callbacks = attach.mock.calls[0][2]!.callbacks!;
  callbacks.onNoFill!({ slotId:'slot',adGroupId:'group',adMetadata:{} });
  callbacks.onAdFailedToRender!({ slotId:'slot',adGroupId:'group',adMetadata:{},error:{ code:1,message:'network' } });
  expect(unavailable).toHaveBeenCalledTimes(2); dispose(); unavailable.mockClear();
  callbacks.onNoFill!({ slotId:'slot',adGroupId:'group',adMetadata:{} }); expect(unavailable).not.toHaveBeenCalled();
});
it('SDK 예외가 나도 독서 화면으로 전파하지 않아요',async () => {
  const { mountBanner } = await import('../src/banner');
  attach.mockImplementationOnce(() => { throw new Error('bridge'); });
  const unavailable = vi.fn(); mountBanner(target,unavailable);
  initialize.mock.calls[0][0].callbacks!.onInitialized!(); await flush(); expect(unavailable).toHaveBeenCalledOnce();
});
