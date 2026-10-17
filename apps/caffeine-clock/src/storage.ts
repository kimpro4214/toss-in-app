import { initialState, validateRecord } from './engine';
import type { IntakeRecord, PersistedState, Preferences } from './types';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const https = (v: unknown) => typeof v === 'string' && /^https:\/\//.test(v);
export function parseBackup(text: string): PersistedState {
  if (text.length > 10_000_000) throw new Error('백업은 10MB 이하로 선택해 주세요.');
  let s: unknown;
  try { s = JSON.parse(text); } catch { throw new Error('올바른 JSON 백업 파일이 아니에요.'); }
  if (!object(s) || s.version !== 1 || !object(s.preferences) || !Array.isArray(s.records) || !Array.isArray(s.favorites)) throw new Error('지원하는 오늘 카페인 v1 백업이 아니에요.');
  const p = s.preferences;
  if (typeof p.bedtime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.bedtime) || ![3, 5, 7].includes(p.halfLifeHours as number) || ![6, 9, 12].includes(p.cutoffHours as number) || ![null, '19-29', '30-49', '50-64', '65-74', '75+'].includes(p.ageBand as null) || ![null, 'male', 'female'].includes(p.referenceSex as null) || !['none', 'reference', 'custom'].includes(p.waterGoalMode as string) || !(p.customWaterGoalMl === null || typeof p.customWaterGoalMl === 'number' && Number.isInteger(p.customWaterGoalMl) && p.customWaterGoalMl >= 100 && p.customWaterGoalMl <= 5000)) throw new Error('백업의 설정 값을 확인해 주세요.');
  if (p.waterGoalMode === 'reference' && (!p.ageBand || !p.referenceSex) || p.waterGoalMode === 'custom' && p.customWaterGoalMl === null) throw new Error('수분 목표에 필요한 설정이 없어요.');
  const ids = new Set<string>();
  const records = s.records.map(value => {
    if (!object(value) || typeof value.id !== 'string' || !value.id || ids.has(value.id) || !(value.variantId === null || typeof value.variantId === 'string') || typeof value.name !== 'string' || !['coffee', 'tea', 'energy', 'packaged', 'water', 'other'].includes(value.kind as string) || typeof value.volumeEstimated !== 'boolean' || !(value.sourceUrl === null || https(value.sourceUrl)) || !(value.sourceCheckedAt === null || typeof value.sourceCheckedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.sourceCheckedAt)) || typeof value.consumedAt !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value.consumedAt)) throw new Error('백업의 음료 기록이 올바르지 않거나 중복돼요.');
    const record = value as unknown as IntakeRecord; validateRecord(record); ids.add(record.id);
    return { id: record.id, variantId: record.variantId, name: record.name, kind: record.kind, caffeineMg: record.caffeineMg, volumeMl: record.volumeMl, volumeEstimated: record.volumeEstimated, consumedAt: record.consumedAt, sourceUrl: record.sourceUrl, sourceCheckedAt: record.sourceCheckedAt };
  });
  if (s.favorites.some(id => typeof id !== 'string' || id.length > 150) || new Set(s.favorites).size !== s.favorites.length) throw new Error('즐겨찾기 데이터가 올바르지 않아요.');
  return { version: 1, preferences: { ...initialState().preferences, bedtime: p.bedtime, halfLifeHours: p.halfLifeHours, cutoffHours: p.cutoffHours, ageBand: p.ageBand, referenceSex: p.referenceSex, waterGoalMode: p.waterGoalMode, customWaterGoalMl: p.customWaterGoalMl } as Preferences, records, favorites: s.favorites as string[] };
}
export interface Store { read(): Promise<string | null>; write(value: string): Promise<void>; checkIdentity?(): Promise<void> }
export class StateSession {
  private locked = false;
  constructor(public state: PersistedState, private store: Store) {}
  static async open(store: Store): Promise<StateSession> {
    const raw = await store.read(); return new StateSession(raw === null ? initialState() : parseBackup(raw), store);
  }
  async commit(update: (state: PersistedState) => PersistedState): Promise<PersistedState> {
    if (this.locked) throw new Error('앞선 저장이 끝난 뒤 다시 시도해 주세요.');
    this.locked = true;
    try {
      const next = parseBackup(JSON.stringify(update(this.state)));
      await this.store.write(JSON.stringify(next)); this.state = next; return next;
    } finally { this.locked = false; }
  }
  async checkIdentity() { await this.store.checkIdentity?.(); }
}
