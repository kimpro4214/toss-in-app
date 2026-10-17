import type { AgeBand, IntakeRecord, PersistedState, Preferences, ReferenceSex } from './types';

export const HOUR = 3_600_000;
export function initialState(): PersistedState {
  return { version: 1, preferences: { bedtime: '23:00', halfLifeHours: 5, cutoffHours: 9, ageBand: null, referenceSex: null, waterGoalMode: 'none', customWaterGoalMl: null }, records: [], favorites: [] };
}
export function dateKey(time: number | Date): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function inputDateTime(time: number): string {
  const d = new Date(time);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function nextBedtime(now: number, bedtime: string): number {
  const [hours, minutes] = bedtime.split(':').map(Number);
  const d = new Date(now); d.setHours(hours, minutes, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
export function residual(records: IntakeRecord[], at: number, halfLifeHours: number): number {
  return records.reduce((sum, r) => {
    const elapsed = at - Date.parse(r.consumedAt);
    return elapsed < 0 ? sum : sum + r.caffeineMg * 0.5 ** (elapsed / (halfLifeHours * HOUR));
  }, 0);
}
export function belowTenAt(records: IntakeRecord[], now: number, halfLifeHours: number): number {
  const amount = residual(records, now, halfLifeHours);
  return amount < 10 ? now : now + Math.ceil(halfLifeHours * HOUR * Math.log2(amount / 10)) + 1;
}
export function totals(records: IntakeRecord[], date: string) {
  const today = records.filter(r => dateKey(Date.parse(r.consumedAt)) === date);
  return { caffeineMg: today.reduce((s, r) => s + r.caffeineMg, 0),
    waterMl: today.filter(r => r.kind === 'water').reduce((s, r) => s + r.volumeMl, 0),
    drinksMl: today.filter(r => r.kind !== 'water').reduce((s, r) => s + r.volumeMl, 0), count: today.length };
}
const LIQUID: Record<ReferenceSex, Record<AgeBand, number>> = {
  male: { '19-29': 1200, '30-49': 1200, '50-64': 1000, '65-74': 1000, '75+': 1100 },
  female: { '19-29': 1000, '30-49': 1000, '50-64': 1000, '65-74': 900, '75+': 1000 },
};
export function waterReference(age: AgeBand, sex: ReferenceSex): number { return LIQUID[sex][age]; }
export function waterGoal(p: Preferences): number | null {
  if (p.waterGoalMode === 'custom') return p.customWaterGoalMl;
  return p.waterGoalMode === 'reference' && p.ageBand && p.referenceSex ? waterReference(p.ageBand, p.referenceSex) : null;
}
export function weekSummary(records: IntakeRecord[], now: number, p: Preferences) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now); day.setDate(day.getDate() - 6 + i);
    const date = dateKey(day);
    const late = records.filter(r => {
      const at = Date.parse(r.consumedAt);
      return dateKey(at) === date && r.caffeineMg > 0 && at >= nextBedtime(at, p.bedtime) - p.cutoffHours * HOUR;
    }).length;
    return { date, ...totals(records, date), late };
  });
}
export function formatMg(value: number): string { return value > 0 && value < 1 ? '1 미만' : Math.round(value).toLocaleString('ko-KR'); }
export function formatTime(time: number): string { return new Date(time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
export function formatMoment(time: number, now: number): string {
  return `${dateKey(time) === dateKey(now) ? '오늘' : new Date(time).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} ${formatTime(time)}`;
}
export function validateRecord(r: IntakeRecord, now = Date.now()): void {
  if (!r.name.trim() || r.name.length > 120 || !Number.isFinite(r.caffeineMg) || r.caffeineMg < 0 || r.caffeineMg > 2000 || !Number.isFinite(r.volumeMl) || r.volumeMl <= 0 || r.volumeMl > 5000 || !Number.isFinite(Date.parse(r.consumedAt)) || Date.parse(r.consumedAt) > now) throw new Error('이름, 카페인(0~2,000mg), 마신 양(1~5,000mL), 과거·현재 시각을 확인해 주세요.');
  if (r.kind === 'water' && r.caffeineMg !== 0) throw new Error('물 기록의 카페인은 0mg이어야 해요.');
}
