import { TossAds } from '@apps-in-toss/web-framework';

let initialization:Promise<void> | undefined;
export function mountBanner(target:HTMLElement, onUnavailable:() => void):() => void {
  const id = import.meta.env.VITE_BANNER_AD_GROUP_ID?.trim();
  let active = true, destroy = () => {};
  const unavailable = () => { if (active) onUnavailable(); };
  try {
    if (!id || !TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) {
      unavailable();
      return () => { active = false; };
    }
    // 탭 전환과 입력 화면 복귀에도 SDK 초기화는 한 번만 해요.
    initialization ??= new Promise<void>((resolve,reject) => TossAds.initialize({ callbacks:{ onInitialized:resolve,onInitializationFailed:reject } }));
    void initialization.then(() => {
      if (!active) return;
      const attached = TossAds.attachBanner(id,target,{ theme:'light',tone:'blackAndWhite',variant:'expanded',callbacks:{ onNoFill:unavailable,onAdFailedToRender:unavailable } });
      destroy = () => attached.destroy();
    }).catch(unavailable);
  } catch { unavailable(); }
  return () => { active = false; destroy(); };
}
