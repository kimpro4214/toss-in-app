import { Device, Environment, NavigationBar, SafeArea, Screen, Storage, User, graniteEvent } from '@apps-in-toss/web-framework';
import { parseState } from './persistence';
import type { State } from './types';

export const native = (() => { try { if (Environment.tossAppVersion) return true; } catch { /* 브라우저 개발 환경이에요. */ } return /TossApp|AppsInToss/i.test(navigator.userAgent) || /\.(private-)?web\.tossmini\.com$/.test(location.hostname); })();
export interface Store { load(): Promise<State>; save(s: State): Promise<void> }
export async function createStore(): Promise<Store> {
  const user = native ? (await User.getAnonymousKey()).hash : 'browser';
  const key = `dividend-fire:v1:${user}`;
  return { load: async () => parseState(native ? await Storage.getItem(key) : localStorage.getItem(key)), save: async s => { const raw = JSON.stringify(s); parseState(raw); if (native) await Storage.setItem(key, raw); else localStorage.setItem(key, raw); } };
}
export function setupNavigation(back: () => void) {
  if (!native) return () => {};
  void NavigationBar.setOptions({ withBackButton: true, withHomeButton: false, withTitle: true, theme: 'light' });
  const apply = (insets: { top: number; bottom: number }) => { document.documentElement.style.setProperty('--safe-top', `${insets.top}px`); document.documentElement.style.setProperty('--safe-bottom', `${insets.bottom}px`); };
  apply(SafeArea.get());
  const a = SafeArea.subscribe({ onEvent: apply });
  const b = graniteEvent.addEventListener('backEvent', { onEvent: back });
  return () => { a(); b(); };
}
export const closeApp = () => native ? Screen.close() : Promise.resolve();
export function openUrl(url: string) { if (native) void Device.openURL(url); else window.open(url, '_blank', 'noopener,noreferrer'); }
