import { Analytics, Device, Environment, File as TossFile, NavigationBar, SafeArea, Screen, Storage, User, graniteEvent } from '@apps-in-toss/web-framework';
import { stateStore, type Store } from './storage';

export const native = (() => {
  try { if (Environment.tossAppVersion) return true; } catch { /* 일반 브라우저에는 토스 상수가 없습니다. */ }
  return /TossApp|AppsInToss/i.test(navigator.userAgent) || /\.(private-)?(web\.)?apps\.tossmini\.com$/.test(location.hostname) || /\.(private-)?web\.tossmini\.com$/.test(location.hostname);
})();
export async function createStore(): Promise<Store> {
  // 기존 저장 키는 유지하고 JSON 내부 버전으로 시간 기록을 이전합니다.
  if (!native) return stateStore({ getItem: async key => localStorage.getItem(key), setItem: async (key, value) => { localStorage.setItem(key, value); } }, 'today-pages:v1:browser');
  const { hash } = await User.getAnonymousKey();
  const check = async () => { if ((await User.getAnonymousKey()).hash !== hash) throw new Error('토스 계정이 바뀌었어요. 앱을 다시 열어 주세요.'); };
  return { ...stateStore({ getItem: async key => { await check(); return Storage.getItem(key); }, setItem: async (key, value) => { await check(); await Storage.setItem(key, value); } }, `today-pages:v1:${hash}`), identity: hash };
}
export type EventName = 'app_open' | 'book_added' | 'record_saved' | 'round_completed' | 'backup_exported' | 'backup_restored';
export function track(event: EventName, durationMs?: number) {
  if (!native) return;
  const values = durationMs === undefined ? {} : { duration_ms: Math.round(Math.max(0, durationMs)) };
  try { Analytics.click({ log_name: `today_pages_${event}`, ...values })?.catch(() => {}); } catch { /* 계측 실패는 기록 저장에 영향을 주지 않습니다. */ }
}
export function setupNavigation(back: () => void): () => void {
  if (!native) return () => {};
  const insets = (v: { top: number; bottom: number }) => {
    document.documentElement.style.setProperty('--safe-top', `${v.top}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${v.bottom}px`);
  };
  const cleanup: (() => void)[] = [];
  try {
    NavigationBar.setOptions({ withBackButton: true, withHomeButton: false, withTitle: true, theme: 'light' }).catch(() => {});
    insets(SafeArea.get());
    cleanup.push(SafeArea.subscribe({ onEvent: insets }));
    cleanup.push(graniteEvent.addEventListener('backEvent', { onEvent: back }));
  } catch { /* 기본 웹 화면은 그대로 사용할 수 있습니다. */ }
  return () => cleanup.forEach(fn => fn());
}
export function closeApp() { if (native) Screen.close().catch(() => {}); }
export function openSource(url: string) {
  if (!url.startsWith('https://')) return;
  if (native) Device.openURL(url).catch(() => {}); else window.open(url, '_blank', 'noopener,noreferrer');
}
export async function saveFile(data: Uint8Array, filename: string, mime: string): Promise<void> {
  if (native) {
    if (!TossFile.saveBase64.isSupported()) throw new Error('파일 저장을 사용하려면 토스 앱을 업데이트해 주세요. 백업 내용은 설정에서 직접 확인할 수 있어요.');
    let binary = '';
    for (let offset = 0; offset < data.length; offset += 8192) binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
    await TossFile.saveBase64({ data: btoa(binary), fileName: filename, mimeType: mime });
  } else {
    const blob = new Blob([new Uint8Array(data)], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
