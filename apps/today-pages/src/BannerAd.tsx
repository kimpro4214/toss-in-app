import { useEffect, useRef, useState } from 'react';
import { mountBanner } from './banner';

export function BannerAd() {
  const target = useRef<HTMLDivElement>(null);
  const [unavailable,setUnavailable] = useState(false);
  useEffect(() => {
    if (!target.current || unavailable) return;
    return mountBanner(target.current,() => setUnavailable(true));
  },[unavailable]);
  if (unavailable) return null;
  return <aside className="banner-ad" aria-label="광고"><div className="banner-ad-slot" ref={target} /></aside>;
}
