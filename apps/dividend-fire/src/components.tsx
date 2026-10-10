import { useEffect, useState, type ReactNode } from 'react';
import { ListRow, TextField, Top } from '@toss/tds-mobile';
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const money = (n: number) => `${fmt(n)}원`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export type Tab = 'income' | 'fire' | 'tax';
export function Icon({ kind }: { kind: Tab | 'back' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'income' ? <><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M7 6V4h10v2M16 15h2"/></> : kind === 'fire' ? <><path d="M4 20V13m6 7V9m6 11V5M3 8l6-3 5 1 7-4M17 2h4v4"/></> : kind === 'tax' ? <><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h5"/></> : <path d="m14 5-7 7 7 7"/>}</svg>;
}
export function Amount({ label, value, onChange, unit = '원', signed = false, max = Infinity }: { label: string; value: number | null; onChange: (n: number | null) => void; unit?: string; signed?: boolean; max?: number }) {
  const [draft,setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => { setDraft(value === null ? '' : String(value)); },[value]);
  return <TextField variant="box" label={label} labelOption="sustain" aria-label={label} inputMode="decimal" value={draft} suffix={unit} placeholder="입력해 주세요" onBlur={() => setDraft(value === null ? '' : String(value))} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (raw === '') { setDraft(raw); onChange(null); } else if (/^-?\d*(\.\d*)?$/.test(raw) && (signed || !raw.startsWith('-')) && (raw === '-' || Number(raw) <= max)) { setDraft(raw); if (Number.isFinite(Number(raw))) onChange(Number(raw)); } }} />;
}
export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return <label className="select"><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
}
export function Check({ children, checked, onChange }: { children: ReactNode; checked: boolean; onChange: (v: boolean) => void }) { return <label className="check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>; }
export function Row({ label, value, note }: { label: string; value: ReactNode; note?: string }) { return <ListRow border="none" contents={<div className="row-label">{label}{note && <small>{note}</small>}</div>} right={<strong className="row-value">{value}</strong>} />; }
export function Title({ title, subtitle }: { title: string; subtitle?: string }) { return <Top title={<Top.TitleParagraph>{title}</Top.TitleParagraph>} subtitleBottom={subtitle && <Top.SubtitleParagraph>{subtitle}</Top.SubtitleParagraph>} />; }
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) { return <div className={`notice ${warning ? 'warning' : ''}`}>{children}</div>; }
export function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="section"><h2>{title}</h2>{children}</section>; }
export function MonthsChart({ months,actual=false }: { months: { month: number; cash: number }[]; actual?:boolean }) {
  const max = Math.max(1, ...months.map(m => m.cash));
  return <><div className="bar-chart" role="img" aria-label={`월별 ${actual ? '기록한 실제' : '예상'} 입금액. ${months.filter(m => m.cash > 0).map(m => `${m.month}월 ${money(m.cash)}`).join(', ') || '입금액이 없어요.'}`}>
    {months.map(m => <div className="bar-column" key={m.month}><div className="bar-track"><div className={`bar ${m.cash > 0 ? '' : 'zero'}`} style={{ height: `${m.cash / max * 100}%` }} /></div><span>{m.month}</span></div>)}
  </div><p className="chart-caption">1~12월 · {actual ? '기록한 일반계좌 실제 입금액' : '원천징수 후 예상액'} · 단위: 원</p><details><summary>지급월별 금액 확인하기</summary>{months.map(m => <Row key={m.month} label={`${m.month}월`} value={money(m.cash)} />)}</details></>;
}
export function FireChart({ points }: { points: { year: number; coverage: number }[] }) {
  const max = Math.max(1.2,...points.map(p => p.coverage)), x = (i: number) => 20 + i / Math.max(1,points.length - 1) * 288, y = (v: number) => 130 - Math.max(0,v) / max * 110;
  return <><svg className="line-chart" viewBox="0 0 328 165" role="img" aria-label={`생활비 충당률. ${points[0].year}년 ${pct(points[0].coverage)}에서 ${points.at(-1)!.year}년 ${pct(points.at(-1)!.coverage)}까지`}><path d={`M20 ${y(1)}H308`} stroke="var(--adaptiveGrey300)" strokeDasharray="4 4" /><text x="22" y={y(1) - 8}>목표 100%</text><polyline points={points.map((p,i) => `${x(i)},${y(p.coverage)}`).join(' ')} fill="none" stroke="#147d73" strokeWidth="3" strokeLinejoin="round" /><text x="20" y="158">{points[0].year}년</text><text textAnchor="end" x="308" y="158">{points.at(-1)!.year}년</text></svg><p className="chart-caption">실선: 세후 생활비 충당률 · 단위: %</p></>;
}
