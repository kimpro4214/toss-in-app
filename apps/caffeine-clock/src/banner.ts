import { TossAds } from '@apps-in-toss/web-framework';
import { native, track } from './platform';

let initialization: Promise<void> | undefined;
export function mountBanner(target: HTMLElement, onUnavailable: () => void): () => void {
  const id = import.meta.env.DEV ? 'ait-ad-test-banner-id' : import.meta.env.VITE_BANNER_AD_GROUP_ID?.trim();
  let active = true, removed = false, destroy = () => {};
  const unavailable = () => { if (active && !removed) { removed = true; destroy(); track('banner_unavailable'); onUnavailable(); } };
  try {
    if (!native || !id || !TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) { onUnavailable(); return () => { active = false; }; }
    initialization ??= new Promise<void>((resolve, reject) => TossAds.initialize({ callbacks: { onInitialized: resolve, onInitializationFailed: reject } }));
    void initialization.then(() => {
      if (!active) return;
      track('banner_requested');
      const attached = TossAds.attachBanner(id, target, { theme: 'light', tone: 'blackAndWhite', variant: 'expanded', callbacks: {
        onAdRendered: () => { if (active && !removed) track('banner_rendered'); },
        onAdImpression: () => { if (active && !removed) track('banner_impression'); },
        onAdViewable: () => { if (active && !removed) track('banner_viewable'); },
        onNoFill: unavailable, onAdFailedToRender: unavailable,
      } });
      destroy = () => attached.destroy(); if (!active || removed) destroy();
    }).catch(unavailable);
  } catch { unavailable(); }
  return () => { active = false; if (!removed) destroy(); };
}
