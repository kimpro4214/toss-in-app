import { describe, expect, it } from 'vitest';
import { belowTenAt, dateKey, HOUR, initialState, nextBedtime, residual, totals, validateRecord, waterGoal, waterReference, weekSummary } from '../src/engine';
import { drinks, searchDrinks } from '../src/catalog';
import type { IntakeRecord } from '../src/types';
const now = new Date(2026, 9, 17, 12).getTime();
const record = (mg = 100, at = now): IntakeRecord => ({ id: 'one', name: '시험 음료', variantId: null, kind: 'coffee', caffeineMg: mg, volumeMl: 250, volumeEstimated: false, consumedAt: new Date(at).toISOString(), sourceUrl: null, sourceCheckedAt: null });
describe('기록 기반 카페인 계산', () => {
  it('5시간 반감기의 100 → 50 → 25mg', () => { expect(residual([record()], now, 5)).toBe(100); expect(residual([record()], now + 5 * HOUR, 5)).toBe(50); expect(residual([record()], now + 10 * HOUR, 5)).toBe(25); });
  it('각 시점의 여러 잔을 독립적으로 합산', () => { expect(residual([record(100, now - 5 * HOUR), record(60)], now, 5)).toBe(110); });
  it('자정에 잔여량이 사라지지 않음', () => { const midnight = new Date(2026, 9, 18, 0).getTime(); expect(residual([record(100, midnight - HOUR)], midnight, 5)).toBeGreaterThan(80); expect(totals([record(100, midnight - HOUR)], dateKey(midnight)).caffeineMg).toBe(0); });
  it('아직 마시지 않은 기록 제외, 디카페인도 실제 함량 반영', () => { expect(residual([record(0), record(8), record(100, now + HOUR)], now, 5)).toBe(8); });
  it('10mg 미만 도달 시각은 기준보다 엄밀히 작아짐', () => { const at = belowTenAt([record()], now, 5); expect(residual([record()], at, 5)).toBeLessThan(10); expect(at - now).toBeCloseTo(5 * HOUR * Math.log2(10), -1); expect(belowTenAt([record(5)], now, 5)).toBe(now); expect(belowTenAt([record(10)], now, 5)).toBeGreaterThan(now); });
  it('반감기 비교는 용량·기록을 바꾸지 않음', () => { const records = [record()]; expect(residual(records, now + 5 * HOUR, 3)).toBeLessThan(50); expect(residual(records, now + 5 * HOUR, 7)).toBeGreaterThan(50); expect(records[0].caffeineMg).toBe(100); });
  it('자정 이후 취침 및 이미 지난 취침 시각 처리', () => { const late = new Date(2026, 9, 17, 23, 30).getTime(); expect(new Date(nextBedtime(late, '01:00')).getDate()).toBe(18); expect(new Date(nextBedtime(late, '01:00')).getHours()).toBe(1); expect(new Date(nextBedtime(late, '23:00')).getDate()).toBe(18); });
  it('물·음료를 분리하고 커피 때문에 물을 차감하지 않음', () => { const water = { ...record(0), kind: 'water' as const }; expect(totals([water, record(100)], dateKey(now))).toEqual({ caffeineMg: 100, waterMl: 250, drinksMl: 250, count: 2 }); });
  it('최근 7일은 빈 날짜도 포함하며 생활 목표 이후 기록을 구분', () => { const afternoon = new Date(2026, 9, 17, 15).getTime(); const days = weekSummary([record(100, afternoon), { ...record(0, afternoon), kind: 'water' }], now, initialState().preferences); expect(days).toHaveLength(7); expect(days[6].late).toBe(1); expect(days[6].caffeineMg).toBe(100); });
  it('누락·미래 시각·음수·잘못된 물 카페인 차단', () => { expect(() => validateRecord(record(), now)).not.toThrow(); for (const r of [{ ...record(), name: '' }, record(-1), record(100, now + HOUR), { ...record(), volumeMl: NaN }, { ...record(), kind: 'water' as const }]) expect(() => validateRecord(r, now)).toThrow(); });
});
describe('국내 액체 충분섭취량', () => {
  it.each([['19-29', 1200, 1000], ['30-49', 1200, 1000], ['50-64', 1000, 1000], ['65-74', 1000, 900], ['75+', 1100, 1000]] as const)('%s세 참고표의 액체 열 사용', (age, male, female) => { expect(waterReference(age, 'male')).toBe(male); expect(waterReference(age, 'female')).toBe(female); });
  it('선택하지 않으면 목표 없음, 개인 목표 우선', () => { const p = initialState().preferences; expect(waterGoal(p)).toBeNull(); expect(waterGoal({ ...p, waterGoalMode: 'reference' })).toBeNull(); expect(waterGoal({ ...p, ageBand: '65-74', referenceSex: 'female', waterGoalMode: 'reference' })).toBe(900); expect(waterGoal({ ...p, waterGoalMode: 'custom', customWaterGoalMl: 1500 })).toBe(1500); });
});
describe('일반 음료 검색', () => {
  it('일반 참고값의 단위·근거가 있고 브랜드 제품 데이터가 없음', () => { expect(new Set(drinks.map(d => d.id)).size).toBe(drinks.length); expect(drinks.every(d => !('brand' in d) && !('country' in d) && Boolean(d.sourceNote) && ['www.efsa.europa.eu', 'www.fda.gov'].includes(new URL(d.sourceUrl).hostname))).toBe(true); expect(drinks.filter(d => d.decaf).every(d => d.caffeineMg > 0)).toBe(true); });
  it('음료 종류·용량 검색과 분류', () => { expect(searchDrinks('아메리카노 250')).toHaveLength(1); expect(searchDrinks('', '디카페인').every(d => d.decaf)).toBe(true); expect(searchDrinks('존재하지않음')).toEqual([]); expect(searchDrinks('에너지', '기타 음료')).toHaveLength(1); });
  it('같은 에스프레소 양에 물을 늘린 예시는 카페인 함량을 유지', () => { const americanos = searchDrinks('아메리카노'); expect(americanos.map(d => d.volumeMl)).toEqual([250, 350, 500]); expect(americanos.every(d => d.caffeineMg === 80 && d.sourceNote.includes('60mL'))).toBe(true); });
});
