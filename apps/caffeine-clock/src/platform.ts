import { Analytics, Device, Environment, File as TossFile, NavigationBar, SafeArea, Screen, Storage, User, graniteEvent } from '@apps-in-toss/web-framework';
import type { Store } from './storage';

export const native = (() => {
  try { if (Environment.tossAppVersion) return true; } catch { /* 브라우저에는 토스 상수가 없어요. */ }
  return /TossApp|AppsInToss/i.test(navigator.userAgent) || /\.(private-)?(web\.)?apps\.tossmini\.com$/.test(location.hostname) || /\.(private-)?web\.tossmini\.com$/.test(location.hostname);
})();
export async function createStore(): Promise<Store> {
  if (!native) return { read: async () => localStorage.getItem('caffeine-clock:v1:browser'), write: async value => localStorage.setItem('caffeine-clock:v1:browser', value) };
  const { hash } = await User.getAnonymousKey();
  const checkIdentity = async () => { if ((await User.getAnonymousKey()).hash !== hash) throw new Error('토스 계정이 바뀌었어요. 앱을 다시 열어 주세요.'); };
  const key = `caffeine-clock:v1:${hash}`;
  return { checkIdentity, read: async () => { await checkIdentity(); return Storage.getItem(key); }, write: async value => { await checkIdentity(); await Storage.setItem(key, value); } };
}
export type EventName = 'app_open' | 'first_record_saved' | 'record_saved' | 'record_updated' | 'record_deleted' | 'preview_viewed' | 'search_empty' | 'favorite_saved' | 'preferences_saved' | 'backup_exported' | 'backup_restored' | 'records_cleared' | 'banner_requested' | 'banner_rendered' | 'banner_impression' | 'banner_viewable' | 'banner_unavailable';
export function track(event: EventName, durationMs?: number) {
  if (!native) return;
  try { Analytics.click({ log_name: `caffeine_clock_${event}`, ...(durationMs === undefined ? {} : { duration_ms: Math.round(Math.max(0, durationMs)) }) })?.catch(() => {}); } catch { /* 계측 실패는 계산·저장을 막지 않아요. */ }
}
export function setupNavigation(back: () => void): () => void {
  if (!native) return () => {};
  const cleanup: (() => void)[] = [];
  const insets = (v: { top: number; bottom: number }) => {
    document.documentElement.style.setProperty('--safe-top', `${v.top}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${v.bottom}px`);
  };
  try {
    NavigationBar.setOptions({ withBackButton: true, withHomeButton: false, withTitle: true, theme: 'light' }).catch(() => {});
    insets(SafeArea.get()); cleanup.push(SafeArea.subscribe({ onEvent: insets }));
    cleanup.push(graniteEvent.addEventListener('backEvent', { onEvent: back }));
  } catch { /* 기본 웹 화면은 계속 이용할 수 있어요. */ }
  return () => cleanup.forEach(fn => fn());
}
export function closeApp() { if (native) Screen.close().catch(() => {}); }
export function openSource(url: string) {
  if (!url.startsWith('https://')) return;
  if (native) Device.openURL(url).catch(() => {}); else window.open(url, '_blank', 'noopener,noreferrer');
}
export async function exportBackup(json: string) {
  const filename = `오늘카페인-${new Date().toISOString().slice(0, 10)}.json`;
  if (native) {
    if (!TossFile.saveBase64.isSupported()) throw new Error('파일 저장을 지원하지 않아요. 아래 백업 내용을 복사해 보관할 수 있어요.');
    const bytes = new TextEncoder().encode(json); let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    await TossFile.saveBase64({ data: btoa(binary), fileName: filename, mimeType: 'application/json' });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
