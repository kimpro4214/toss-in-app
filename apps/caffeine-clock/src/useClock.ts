import { useCallback, useEffect, useState } from 'react';
export function useClock(onResume?: () => void) {
  const [now, setNow] = useState(Date.now);
  const refresh = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => { clearInterval(timer); timer = undefined;
      if (!document.hidden) { setNow(Date.now()); onResume?.(); timer = setInterval(() => setNow(Date.now()), 30_000); }
    };
    update(); document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [onResume]);
  return [now, refresh] as const;
}
