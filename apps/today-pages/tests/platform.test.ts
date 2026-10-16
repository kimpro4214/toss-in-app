import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ getKey: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), save: vi.fn(), click: vi.fn(), supported: vi.fn() }));
vi.mock('@apps-in-toss/web-framework', () => ({
  Environment: { tossAppVersion: '5.300.0' },
  User: { getAnonymousKey: sdk.getKey }, Storage: { getItem: sdk.getItem, setItem: sdk.setItem },
  File: { saveBase64: Object.assign(sdk.save, { isSupported: sdk.supported }) },
  Analytics: { click: sdk.click }, Device: {}, NavigationBar: {}, SafeArea: {}, Screen: {}, graniteEvent: {},
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { userAgent: 'TossApp' }); vi.stubGlobal('location', { hostname: 'app.apps.tossmini.com' });
  sdk.getKey.mockResolvedValue({ hash: 'owner-a' }); sdk.getItem.mockResolvedValue(null); sdk.setItem.mockResolvedValue(undefined); sdk.save.mockResolvedValue(undefined); sdk.supported.mockReturnValue(true);
});
describe('토스 어댑터 계약 (SDK 모의 테스트)', () => {
  it('사용자별 키로 저장하고 계정 변경 후 이전 계정에 쓰지 않는다', async () => {
    const { createStore } = await import('../src/platform');
    const { initialState } = await import('../src/engine');
    const store = await createStore(); await store.load(); await store.save(initialState());
    expect(sdk.setItem.mock.calls[0][0]).toBe('today-pages:v1:owner-a');
    sdk.getKey.mockResolvedValue({ hash: 'owner-b' });
    await expect(store.save(initialState())).rejects.toThrow('계정'); expect(sdk.setItem).toHaveBeenCalledTimes(1);
  });
  it('식별키 실패 시 공용 저장소로 대체하지 않는다', async () => {
    const { createStore } = await import('../src/platform');
    sdk.getKey.mockRejectedValue(new Error('unsupported'));
    await expect(createStore()).rejects.toThrow(); expect(sdk.getItem).not.toHaveBeenCalled();
  });
  it('백업은 UTF-8 바이트를 base64로 전달하고 저장 실패를 호출자에게 알린다', async () => {
    const { saveFile } = await import('../src/platform');
    const data = new TextEncoder().encode('한글 백업'); await saveFile(data, 'backup.json', 'application/json');
    expect(Buffer.from(sdk.save.mock.calls[0][0].data, 'base64').toString('utf8')).toBe('한글 백업');
    sdk.save.mockRejectedValue(new Error('cancelled')); await expect(saveFile(data, 'backup.json', 'application/json')).rejects.toThrow('cancelled');
    sdk.supported.mockReturnValue(false); await expect(saveFile(data, 'backup.json', 'application/json')).rejects.toThrow('업데이트');
  });
  it('분석에는 허용된 이벤트 이름과 시간만 전달한다', async () => {
    const { track } = await import('../src/platform'); track('record_saved', 2345.6);
    expect(sdk.click).toHaveBeenCalledWith({ log_name: 'today_pages_record_saved', duration_ms: 2346 });
  });
});
