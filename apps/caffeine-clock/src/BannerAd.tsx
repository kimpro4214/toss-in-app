import { useEffect, useRef, useState } from 'react';
import { mountBanner } from './banner';
export function BannerAd() {
  const target = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    return mountBanner(target.current, () => setUnavailable(true));
  }, []);
  return unavailable ? null : <aside className="banner" aria-label="광고"><div ref={target} /></aside>;
}
