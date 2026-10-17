import { useEffect, useRef, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Button as TDSButton } from '@toss/tds-mobile';
import { HOUR, formatMg, formatTime, residual } from './engine';
import type { IntakeRecord } from './types';

export function Button({ variant, style, ...props }: ComponentProps<typeof TDSButton>) {
  return <TDSButton {...props} variant={variant} style={{ minHeight: 48, '--button-background-color': variant === 'weak' ? '#EEE7DF' : '#76513C', '--button-color': variant === 'weak' ? '#76513C' : '#fff', '--button-gradient-color': '#60402F', ...style } as CSSProperties} />;
}
export function Icon({ name, size = 24 }: { name: 'cup' | 'moon' | 'drop' | 'home' | 'search' | 'history' | 'settings' | 'plus' | 'arrow'; size?: number }) {
  const paths = {
    cup: <><path d="M4 8h13v7a6.5 6.5 0 0 1-13 0V8Zm13 1h2a3 3 0 0 1 0 6h-2M8 3v2m5-2v2" /><path d="M3 22h15" /></>,
    moon: <path d="M20.5 13.2A9 9 0 0 1 10.8 3.5 9 9 0 1 0 20.5 13.2Z" />,
    drop: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Zm-3 13c0 2 1 3 3 3" />,
    home: <><path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
    history: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-3v6l4 2" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="8" cy="18" r="2" fill="currentColor" /></>,
    plus: <path d="M12 5v14M5 12h14" />, arrow: <path d="m9 5 7 7-7 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function Sheet({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current!; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={dialog} className="sheet" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="sheet-handle" /><header className="sheet-header"><h2>{title}</h2><button className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}
export function Chart({ records, now, bedtime, halfLife }: { records: IntakeRecord[]; now: number; bedtime: number; halfLife: number }) {
  const until = Math.max(bedtime, now + 12 * HOUR);
  const points = Array.from({ length: 25 }, (_, i) => { const at = now + (until - now) * i / 24; return { at, mg: residual(records, at, halfLife) }; });
  const max = Math.max(10, points[0].mg), y = (mg: number) => 96 - mg / max * 72;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${12 + i * 12.33},${y(p.mg)}`).join(' ');
  const bx = 12 + (bedtime - now) / (until - now) * 296;
  const sleep = residual(records, bedtime, halfLife);
  return <figure className="chart"><svg viewBox="0 0 320 122" role="img" aria-label={`카페인 예상 감소 그래프. 현재 ${formatMg(points[0].mg)}mg, 취침 시점 ${formatMg(sleep)}mg. 반감기 ${halfLife}시간 가정.`}>
    <defs><linearGradient id="caffeine-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B28C6D" stopOpacity=".28" /><stop offset="100%" stopColor="#B28C6D" stopOpacity="0" /></linearGradient></defs>
    <path d="M12 96H308" stroke="#E4DBD1" strokeDasharray="3 5" /><path d={`${line} L308 96 L12 96Z`} fill="url(#caffeine-fill)" />
    <path d={line} fill="none" stroke="#8C6549" strokeWidth="2.5" /><path d={`M${bx} 12V96`} stroke="#BDAD9D" strokeDasharray="3 4" />
    <circle cx={bx} cy={y(sleep)} r="4" fill="#76513C" stroke="white" strokeWidth="2" />
    <text x="12" y="117">지금 {formatTime(now)}</text><text x="308" y="117" textAnchor="end">{formatTime(until)}</text>
  </svg><figcaption>반감기 {halfLife}시간 가정 · 점선은 목표 취침 시각</figcaption></figure>;
}
