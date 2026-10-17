import { expect, it, vi } from 'vitest';
import { initialState } from '../src/engine';
import { parseBackup, StateSession } from '../src/storage';
import type { IntakeRecord } from '../src/types';
const r: IntakeRecord = { id: 'stable-id', variantId: 'product-id', name: '내 커피', kind: 'coffee', caffeineMg: 100, volumeMl: 250, volumeEstimated: false, consumedAt: '2026-01-01T01:00:00.000Z', sourceUrl: 'https://example.com/nutrition', sourceCheckedAt: '2026-01-01' };
it('백업 왕복은 함량 스냅샷과 설정을 보존', () => { const s = { ...initialState(), records: [r], favorites: ['product-id'] }; expect(parseBackup(JSON.stringify(s))).toEqual(s); });
it('잘못된 버전·설정·중복 기록·미확인 함량·위험한 URL 거부', () => {
  const s = initialState();
  const invalid = [{ ...s, version: 2 }, { ...s, preferences: { ...s.preferences, bedtime: '25:00' } }, { ...s, preferences: { ...s.preferences, halfLifeHours: 0 } }, { ...s, preferences: { ...s.preferences, waterGoalMode: 'reference' } }, { ...s, preferences: { ...s.preferences, waterGoalMode: 'custom', customWaterGoalMl: null } }, { ...s, records: [r, r] }, { ...s, records: [{ ...r, caffeineMg: null }] }, { ...s, records: [{ ...r, consumedAt: '언젠가' }] }, { ...s, records: [{ ...r, sourceUrl: 'javascript:alert(1)' }] }];
  for (const value of invalid) expect(() => parseBackup(JSON.stringify(value))).toThrow();
  expect(() => parseBackup('{')).toThrow();
});
it('읽기 실패·손상 시 자동 초기화하거나 덮어쓰지 않음', async () => { const write = vi.fn(); await expect(StateSession.open({ read: async () => 'broken', write })).rejects.toThrow(); expect(write).not.toHaveBeenCalled(); });
it('저장 실패 시 성공 상태를 만들지 않고 안전하게 재시도', async () => {
  const store = { read: async () => null, write: vi.fn().mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValue(undefined) };
  const session = await StateSession.open(store);
  const update = (s: ReturnType<typeof initialState>) => ({ ...s, records: [...s.records, r] });
  await expect(session.commit(update)).rejects.toThrow('저장 실패'); expect(session.state.records).toEqual([]);
  await session.commit(update); expect(session.state.records).toEqual([r]); expect(store.write).toHaveBeenCalledTimes(2);
});
it('저장 중 중복 제출을 막음', async () => {
  let complete!: () => void;
  const store = { read: async () => null, write: vi.fn(() => new Promise<void>(resolve => { complete = resolve; })) };
  const session = await StateSession.open(store);
  const first = session.commit(s => ({ ...s, records: [r] }));
  await expect(session.commit(s => ({ ...s, records: [r, r] }))).rejects.toThrow('앞선 저장');
  complete(); await first; expect(store.write).toHaveBeenCalledTimes(1); expect(session.state.records).toHaveLength(1);
});
it('백업 교체 실패 시 원본 유지', async () => { const s = { ...initialState(), records: [r] }; const session = new StateSession(s, { read: async () => null, write: async () => { throw Error('용량 부족'); } }); await expect(session.commit(initialState)).rejects.toThrow(); expect(session.state).toEqual(s); });
