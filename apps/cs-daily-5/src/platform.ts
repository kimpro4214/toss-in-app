import { Analytics, Device, User, Storage, SafeArea, Screen, NavigationBar, Environment, graniteEvent, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { initialState } from './engine';
import { BANK_VERSION } from './bank';
import type { State } from './types';
import { levels } from './types';
import { subjects } from './subjects';

export const native = (() => {
  try { if (Environment.tossAppVersion) return true; } catch { /* 일반 브라우저에는 네이티브 상수가 없습니다. */ }
  return /TossApp|AppsInToss/i.test(navigator.userAgent) || /\.(private-)?web\.tossmini\.com$/.test(location.hostname);
})();
export interface StateStore { load(): Promise<State>; save(state: State): Promise<void> }
export function parseState(raw: string | null): State {
  if (!raw) return initialState(BANK_VERSION);
  const value = JSON.parse(raw);
  const record = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const valid = record(value) && value.schemaVersion === 1 && Array.isArray(value.sessions) && record(value.firstAnswers) && record(value.mistakes) && record(value.subjectLevels) && record(value.settings)
    && ['random','focus'].includes(value.settings.mode) && subjects.some(s => s.id === value.settings.subject) && levels.includes(value.settings.startLevel)
    && (value.settings.courseId === undefined || value.settings.courseId === 'game-client-14')
    && (value.preferencesSet === undefined || typeof value.preferencesSet === 'boolean')
    && (value.settings.selectedSubjects === undefined || (Array.isArray(value.settings.selectedSubjects) && value.settings.selectedSubjects.length > 0 && new Set(value.settings.selectedSubjects).size === value.settings.selectedSubjects.length && value.settings.selectedSubjects.every((id: unknown) => subjects.some(s => s.id === id))))
    && value.sessions.every((s: State['sessions'][number]) => record(s) && typeof s.id === 'string' && typeof s.date === 'string' && ['daily','bonus'].includes(s.kind) && record(s.settings)
      && (s.settings.courseId === undefined || s.settings.courseId === 'game-client-14')
      && (s.kind === 'daily' && s.settings.courseId ? Number.isInteger(s.interviewDay) && s.interviewDay! >= 1 && s.interviewDay! <= 14 : s.interviewDay === undefined)
      && Array.isArray(s.entries) && s.entries.length === (s.kind === 'daily' ? 5 : 3) && s.entries.every(e => typeof e.questionId === 'string' && typeof e.review === 'boolean') && record(s.answers))
    && Object.values(value.firstAnswers).every((a: unknown) => record(a) && typeof (a as {choiceId:unknown}).choiceId === 'string' && typeof (a as {correct:unknown}).correct === 'boolean')
    && Object.values(value.subjectLevels).every((l: unknown) => levels.includes(l as typeof levels[number]));
  if (!valid) throw new Error('저장된 기록을 읽을 수 없습니다. 기존 기록은 덮어쓰지 않았습니다.');
  return { ...value, bankVersion: BANK_VERSION };
}
export async function createStore(): Promise<StateStore> {
  const user = native ? (await User.getAnonymousKey()).hash : 'browser';
  const key = `cs-daily-5:v1:${user}`;
  return {
    async load() { return parseState(native ? await Storage.getItem(key) : localStorage.getItem(key)); },
    async save(state) {
      const raw = JSON.stringify(state);
      if (native) await Storage.setItem(key, raw); else localStorage.setItem(key, raw);
    },
  };
}
export function track(name: string, values: Record<string, string | number | boolean> = {}) {
  if (native) {
    const logger = name === 'screen' ? Analytics.screen : name === 'ad_impression' ? Analytics.impression : Analytics.click;
    logger({ log_name: name, ...values })?.catch(error => console.warn('분석 전송 실패', error));
  }
  else if (import.meta.env.DEV) console.debug('[CS5]', name, values);
}
export function setupNavigation(back: () => void, home: () => void): () => void {
  if (!native) return () => {};
  NavigationBar.setOptions({ withBackButton: true, withHomeButton: false, withTitle: true, theme: 'light' }).catch(console.warn);
  const apply = (insets: { top: number; bottom: number }) => {
    document.documentElement.style.setProperty('--safe-top', `${insets.top}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${insets.bottom}px`);
  };
  apply(SafeArea.get());
  const unsubscribeSafe = SafeArea.subscribe({ onEvent: apply });
  const unsubscribeBack = graniteEvent.addEventListener('backEvent', { onEvent: back });
  const unsubscribeHome = graniteEvent.addEventListener('homeEvent', { onEvent: home });
  return () => { unsubscribeSafe(); unsubscribeBack(); unsubscribeHome(); };
}
export const closeApp = () => native ? Screen.close() : Promise.resolve();
export function openSource(url: string) {
  if (native) Device.openURL(url).catch(console.warn); else window.open(url, '_blank', 'noopener,noreferrer');
}
export type AdEvent = 'loaded' | 'requested' | 'impression' | 'userEarnedReward' | 'dismissed' | 'failedToShow';
export interface AdController { show(): void; dispose(): void }
export async function prepareAd(onEvent: (event: AdEvent) => void, onError: (error: Error) => void): Promise<AdController | null> {
  if (import.meta.env.DEV && !native) {
    const { createDevAd } = await import('./dev-ad');
    return createDevAd(onEvent, onError);
  }
  const id = import.meta.env.VITE_REWARDED_AD_GROUP_ID;
  if (!native || !id || !loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) return null;
  let ready = false, showing = false, disposed = false;
  let cancelShow = () => {};
  const timer = window.setTimeout(() => { if (!ready && !disposed) onError(new Error('광고를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.')); }, 15000);
  const cancelLoad = loadFullScreenAd({ options: { adGroupId: id }, onEvent: e => {
    if (disposed) return;
    if (e.type === 'loaded') { ready = true; clearTimeout(timer); onEvent('loaded'); }
  }, onError: e => { clearTimeout(timer); if (!disposed) onError(e); } });
  return {
    show() {
      if (!ready || showing || disposed) return;
      showing = true; ready = false;
      cancelShow = showFullScreenAd({ options: { adGroupId: id }, onEvent: e => {
        if (disposed) return;
        if (e.type === 'dismissed' || e.type === 'failedToShow') showing = false;
        if (['requested', 'impression', 'userEarnedReward', 'dismissed', 'failedToShow'].includes(e.type)) onEvent(e.type as AdEvent);
      }, onError: e => { showing = false; if (!disposed) onError(e); } });
    },
    dispose() { disposed = true; clearTimeout(timer); cancelLoad(); cancelShow(); },
  };
}
