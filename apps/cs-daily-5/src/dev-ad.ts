import type { AdController, AdEvent } from './platform';

// Vite의 DEV 분기에서만 import합니다. 실제 광고·정산으로 기록하지 않습니다.
export function createDevAd(onEvent: (event: AdEvent) => void, onError: (error: Error) => void): AdController {
  const mode = new URLSearchParams(location.search).get('devAd') ?? 'success';
  let disposed = false;
  const timers: number[] = [];
  const later = (callback: () => void) => timers.push(window.setTimeout(() => { if (!disposed) callback(); }, 30));
  later(() => mode === 'load-failure' ? onError(new Error('개발 테스트: 광고 로드 실패')) : onEvent('loaded'));
  return {
    show() {
      onEvent('requested');
      later(() => {
        if (mode === 'show-failure') { onEvent('failedToShow'); return; }
        onEvent('impression');
        if (mode !== 'cancel') { onEvent('userEarnedReward'); if (mode === 'duplicate') onEvent('userEarnedReward'); }
        onEvent('dismissed');
      });
    },
    dispose() { disposed = true; timers.forEach(clearTimeout); },
  };
}
